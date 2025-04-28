# my_uploaders.py

import os
import requests
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import pickle

# === YOUTUBE UPLOADER ===
def upload_to_youtube(content_path, caption):
    print(f"Uploading to YouTube: {content_path}")

    # Setup
    scopes = ["https://www.googleapis.com/auth/youtube.upload"]
    credentials = None

    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as token:
            credentials = pickle.load(token)
    else:
        flow = InstalledAppFlow.from_client_secrets_file("client_secrets.json", scopes)
        credentials = flow.run_console()
        with open("token.pickle", "wb") as token:
            pickle.dump(credentials, token)

    youtube = build('youtube', 'v3', credentials=credentials)

    request = youtube.videos().insert(
        part="snippet,status",
        body={
            "snippet": {
                "title": caption,
                "description": caption,
                "tags": ["example", "upload"],
                "categoryId": "22"  # 22 = People & Blogs
            },
            "status": {
                "privacyStatus": "public"
            }
        },
        media_body=MediaFileUpload(content_path)
    )
    response = request.execute()
    print(f"Uploaded to YouTube: {response['id']}")

# === INSTAGRAM UPLOADER ===
def upload_to_instagram(content_path, caption):
    print(f"Uploading to Instagram: {content_path}")

    # You must first upload the media to a container
    INSTAGRAM_ACCESS_TOKEN = "YOUR_INSTAGRAM_ACCESS_TOKEN"
    INSTAGRAM_USER_ID = "YOUR_INSTAGRAM_USER_ID"

    # 1. Create media container
    create_url = f"https://graph.facebook.com/v18.0/{INSTAGRAM_USER_ID}/media"
    params = {
        "image_url": "YOUR_IMAGE_URL_HERE",  # Instagram needs a PUBLICLY accessible URL
        "caption": caption,
        "access_token": INSTAGRAM_ACCESS_TOKEN
    }
    res = requests.post(create_url, params=params)
    container_id = res.json()["id"]

    # 2. Publish container
    publish_url = f"https://graph.facebook.com/v18.0/{INSTAGRAM_USER_ID}/media_publish"
    publish_params = {
        "creation_id": container_id,
        "access_token": INSTAGRAM_ACCESS_TOKEN
    }
    publish_res = requests.post(publish_url, params=publish_params)
    print("Instagram upload response:", publish_res.json())

# === LINKEDIN UPLOADER ===
def upload_to_linkedin(content_path, caption):
    print(f"Uploading to LinkedIn: {content_path}")

    LINKEDIN_ACCESS_TOKEN = "YOUR_LINKEDIN_ACCESS_TOKEN"
    LINKEDIN_ORGANIZATION_URN = "urn:li:person:YOUR_USER_ID"

    headers = {
        "Authorization": f"Bearer {LINKEDIN_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    
    post_url = "https://api.linkedin.com/v2/ugcPosts"
    post_data = {
        "author": LINKEDIN_ORGANIZATION_URN,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {
                    "text": caption
                },
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }
    
    res = requests.post(post_url, headers=headers, json=post_data)
    print("LinkedIn upload response:", res.json())

# === TIKTOK UPLOADER ===
def upload_to_tiktok(content_path, caption):
    print(f"Uploading to TikTok: {content_path}")

    # TikTok official upload API needs OAuth and App
    # We'll simulate a dummy POST (in real case you need TikTok API app and tokens)

    TIKTOK_ACCESS_TOKEN = "YOUR_TIKTOK_ACCESS_TOKEN"
    TIKTOK_UPLOAD_URL = "https://open.tiktokapis.com/v2/video/upload/"

    headers = {
        "Authorization": f"Bearer {TIKTOK_ACCESS_TOKEN}",
    }

    files = {
        'video': open(content_path, 'rb')
    }

    data = {
        "caption": caption
    }

    res = requests.post(TIKTOK_UPLOAD_URL, headers=headers, files=files, data=data)
    print("TikTok upload response:", res.text)

    #uploads the videos
    # my_uploaders.py
def upload_to_instagram(content_path, caption):
    print(f"Uploading to Instagram: {content_path} with caption: {caption}")
    # TODO: Add Instagram upload code here

def upload_to_linkedin(content_path, caption):
    print(f"Uploading to LinkedIn: {content_path} with caption: {caption}")
    # TODO: Add LinkedIn upload code here

def upload_to_youtube(content_path, caption):
    print(f"Uploading to YouTube: {content_path} with caption: {caption}")
    # TODO: Add YouTube upload code here

def upload_to_tiktok(content_path, caption):
    print(f"Uploading to TikTok: {content_path} with caption: {caption}")
    # TODO: Add TikTok upload code here