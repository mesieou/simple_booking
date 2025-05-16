import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import logging

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}
TIMEOUT = (5, 10)
VISITED = set()

def fetch_html(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
        return response.text
    except Exception as e:
        logging.warning(f"⚠️ Error fetching {url}: {e}")
        return None

def extract_links(base_url, html):
    internal, external = set(), set()
    soup = BeautifulSoup(html, "html.parser")
    parsed_base = urlparse(base_url)

    # List of social media domains to exclude
    social_domains = [
        "facebook.com", "twitter.com", "linkedin.com", "instagram.com", 
        "youtube.com", "tiktok.com", "pinterest.com", "whatsapp.com"
    ]

    for tag in soup.find_all("a", href=True):
        href = tag.get("href")
        if href.startswith("mailto:") or href.startswith("tel:"):
            continue

        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)

        if parsed.scheme.startswith("http"):
            if parsed.netloc == parsed_base.netloc:
                internal.add(full_url)
            else:
                if not any(domain in parsed.netloc for domain in social_domains):
                    external.add(full_url)

    return internal, external


def crawl_page(url, crawl_external=False):
    logging.info(f"\n🔎 Scanning links on: {url}")
    html = fetch_html(url)
    if not html:
        return

    internal_links, external_links = extract_links(url, html)

    print(f"\n🔗 Internal Links ({len(internal_links)}):")
    for link in sorted(internal_links):
        print(link)

    print(f"\n🌐 External Links ({len(external_links)}):")
    for link in sorted(external_links):
        print(link)

    if crawl_external:
        for ext_url in sorted(external_links):
            if ext_url in VISITED:
                continue
            VISITED.add(ext_url)
            print(f"\n➡️ Crawling external: {ext_url}")
            ext_html = fetch_html(ext_url)
            if not ext_html:
                continue
            ext_internal, _ = extract_links(ext_url, ext_html)
            print(f"   🔗 Internal pages found on external domain ({len(ext_internal)}):")
            for i_link in sorted(ext_internal):
                print(f"     - {i_link}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
    START_URL = "https://ysaccounting.com.au"
    crawl_page(START_URL, crawl_external=True)
