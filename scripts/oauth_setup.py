#!/usr/bin/env python3
"""
autopilot.yt — YouTube OAuth Setup
Run once per channel to authorize and store tokens in AWS SSM.

Usage:
  python3 scripts/oauth_setup.py --authorize --channel-id ch_001
  python3 scripts/oauth_setup.py --authorize --channel-id ch_002
  python3 scripts/oauth_setup.py --test --channel-id ch_001
"""

import argparse
import json
import os
import sys

# ── Check dependencies ────────────────────────────────────────────────
try:
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    import boto3
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip3 install google-auth-oauthlib google-api-python-client boto3")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
]

CHANNEL_NAMES = {
    "ch_001": "True Crime Daily",
    "ch_002": "Mind Unlocked",
    "ch_003": "Earth Unseen",
    "ch_004": "Finance Decoded",
}

SSM_REGION = "us-east-1"

# ── Helpers ───────────────────────────────────────────────────────────
def get_client_secret_path():
    """Look for client_secret.json in common locations."""
    candidates = [
        "client_secret.json",
        "scripts/client_secret.json",
        os.path.expanduser("~/client_secret.json"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def authorize(channel_id: str):
    """Run OAuth flow and save token to SSM."""
    channel_name = CHANNEL_NAMES.get(channel_id, channel_id)
    print(f"\n🔐 Authorizing channel: {channel_name} ({channel_id})")
    print("=" * 50)

    # Find client_secret.json
    secret_path = get_client_secret_path()
    if not secret_path:
        print("\n❌ client_secret.json not found.")
        print("Download it from Google Cloud Console:")
        print("  APIs & Services → Credentials → OAuth 2.0 Client → Download JSON")
        print("  Rename to client_secret.json and place it in this directory.")
        sys.exit(1)

    print(f"✓ Found credentials: {secret_path}")
    print(f"\n🌐 Opening browser for Google OAuth...")
    print("  Log in with the Google account that owns the '{channel_name}' YouTube channel.\n")

    # Run OAuth flow
    flow = InstalledAppFlow.from_client_secrets_file(secret_path, SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent")

    # Serialize token
    token_data = {
        "token":         creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri":     creds.token_uri,
        "client_id":     creds.client_id,
        "client_secret": creds.client_secret,
        "scopes":        list(creds.scopes),
    }
    token_json = json.dumps(token_data)

    # Save locally as backup
    local_path = f"token_{channel_id}.json"
    with open(local_path, "w") as f:
        f.write(token_json)
    print(f"✓ Token saved locally: {local_path}")

    # Store in SSM
    ssm_name = f"/tessbuilds/youtube-token-{channel_id}"
    try:
        ssm = boto3.client("ssm", region_name=SSM_REGION)
        ssm.put_parameter(
            Name=ssm_name,
            Value=token_json,
            Type="SecureString",
            Overwrite=True,
        )
        print(f"✓ Token stored in SSM: {ssm_name}")
    except Exception as e:
        print(f"⚠️  SSM store failed: {e}")
        print(f"   Token is saved locally at {local_path}")
        print(f"   Run manually: aws ssm put-parameter --name {ssm_name} --value \"$(cat {local_path})\" --type SecureString --region {SSM_REGION}")

    # Verify by fetching channel info
    print(f"\n🔍 Verifying authorization...")
    try:
        youtube = build("youtube", "v3", credentials=creds)
        response = youtube.channels().list(part="snippet,statistics", mine=True).execute()
        items = response.get("items", [])
        if items:
            ch = items[0]
            snippet = ch["snippet"]
            stats   = ch.get("statistics", {})
            print(f"\n✅ Successfully authorized!")
            print(f"   Channel: {snippet['title']}")
            print(f"   ID:      {ch['id']}")
            print(f"   Subs:    {stats.get('subscriberCount', 'hidden')}")
            print(f"   Videos:  {stats.get('videoCount', '0')}")
        else:
            print("⚠️  Authorized but no channel found on this account.")
            print("   Make sure you logged in with the correct Google account.")
    except Exception as e:
        print(f"⚠️  Verification failed: {e}")

    print(f"\n🎉 Done! Channel {channel_id} is authorized.")
    print(f"   Repeat for other channels:")
    for cid, cname in CHANNEL_NAMES.items():
        if cid != channel_id:
            print(f"   python3 scripts/oauth_setup.py --authorize --channel-id {cid}")


def test_channel(channel_id: str):
    """Test an already-authorized channel by fetching its info."""
    channel_name = CHANNEL_NAMES.get(channel_id, channel_id)
    print(f"\n🔍 Testing channel: {channel_name} ({channel_id})")

    # Try local token first
    local_path = f"token_{channel_id}.json"
    token_data = None

    if os.path.exists(local_path):
        with open(local_path) as f:
            token_data = json.load(f)
        print(f"✓ Loaded token from {local_path}")
    else:
        # Try SSM
        try:
            ssm = boto3.client("ssm", region_name=SSM_REGION)
            result = ssm.get_parameter(
                Name=f"/tessbuilds/youtube-token-{channel_id}",
                WithDecryption=True,
            )
            token_data = json.loads(result["Parameter"]["Value"])
            print(f"✓ Loaded token from SSM")
        except Exception as e:
            print(f"❌ No token found locally or in SSM: {e}")
            print(f"   Run: python3 scripts/oauth_setup.py --authorize --channel-id {channel_id}")
            sys.exit(1)

    creds = Credentials(
        token=token_data["token"],
        refresh_token=token_data["refresh_token"],
        token_uri=token_data["token_uri"],
        client_id=token_data["client_id"],
        client_secret=token_data["client_secret"],
        scopes=token_data["scopes"],
    )

    # Refresh if expired
    if not creds.valid:
        creds.refresh(Request())
        print("✓ Token refreshed")

    youtube = build("youtube", "v3", credentials=creds)
    response = youtube.channels().list(part="snippet,statistics", mine=True).execute()
    items = response.get("items", [])

    if items:
        ch      = items[0]
        snippet = ch["snippet"]
        stats   = ch.get("statistics", {})
        print(f"\n✅ Channel verified!")
        print(f"   Title:       {snippet['title']}")
        print(f"   Channel ID:  {ch['id']}")
        print(f"   Subscribers: {stats.get('subscriberCount', 'hidden')}")
        print(f"   Videos:      {stats.get('videoCount', '0')}")
        print(f"   URL:         https://youtube.com/channel/{ch['id']}")
    else:
        print("⚠️  Token valid but no channel found.")


def list_authorized():
    """List all authorized channels by checking SSM."""
    print("\n📋 Checking authorized channels...\n")
    ssm = boto3.client("ssm", region_name=SSM_REGION)
    for channel_id, channel_name in CHANNEL_NAMES.items():
        ssm_name = f"/tessbuilds/youtube-token-{channel_id}"
        try:
            ssm.get_parameter(Name=ssm_name, WithDecryption=False)
            print(f"  ✅ {channel_name} ({channel_id}) — authorized")
        except ssm.exceptions.ParameterNotFound:
            print(f"  ❌ {channel_name} ({channel_id}) — not authorized")
        except Exception as e:
            print(f"  ⚠️  {channel_name} ({channel_id}) — error: {e}")


# ── Main ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="autopilot.yt YouTube OAuth Setup")
    parser.add_argument("--authorize",   action="store_true", help="Authorize a channel")
    parser.add_argument("--test",        action="store_true", help="Test an authorized channel")
    parser.add_argument("--list",        action="store_true", help="List all authorized channels")
    parser.add_argument("--channel-id",  type=str,            help="Channel ID (ch_001–ch_004)")
    args = parser.parse_args()

    if args.list:
        list_authorized()
    elif args.authorize:
        if not args.channel_id:
            print("❌ --channel-id required. Example: --channel-id ch_001")
            sys.exit(1)
        authorize(args.channel_id)
    elif args.test:
        if not args.channel_id:
            print("❌ --channel-id required. Example: --channel-id ch_001")
            sys.exit(1)
        test_channel(args.channel_id)
    else:
        parser.print_help()
        print("\nExamples:")
        print("  python3 scripts/oauth_setup.py --authorize --channel-id ch_001")
        print("  python3 scripts/oauth_setup.py --test     --channel-id ch_001")
        print("  python3 scripts/oauth_setup.py --list")