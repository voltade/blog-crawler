import requests
import json
import os
from bs4 import BeautifulSoup
from datetime import datetime, timedelta


def scrape_pepperCloud_blog(blogUrl, tag):
    """
    Scrape PepperCloud blog to get the title and content
    """

    inner_html_text = requests.get(
        f'https://blog.peppercloud.com/{blogUrl}').text
    soup = BeautifulSoup(inner_html_text, 'lxml')
    title = soup.find(
        'h1', class_='article-title max-90').text
    description = soup.find(
        'p', class_='article-excerpt max-90').text.strip()

    blogContent = soup.find('section', class_='gh-content')

    if not blogContent:
        print("No content found")
        return

    content_sections = []
    current_section = {"type": "intro", "content": []}

    for element in blogContent.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol']):
        text = element.get_text().strip()
        if not text:
            continue

        if element.name.startswith('h'):
            if current_section["content"]:
                content_sections.append(current_section)
            level = int(element.name[1])
            current_section = {
                "type": f"section_h{level}",
                "heading": text,
                "content": []
            }
        else:
            if element.name in ['ul', 'ol']:
                list_items = [li.get_text().strip()
                              for li in element.find_all('li')]
                current_section["content"].append({
                    "type": "list",
                    "items": list_items
                })
            else:
                current_section["content"].append({
                    "type": "paragraph",
                    "text": text
                })

    # don't forget to add the last section if it exists
    if current_section["content"]:
        content_sections.append(current_section)

    return {
        "title": title,
        "description": description,
        "category": tag,  # Default category, can be updated later
        "sections": content_sections,
        "url": blogUrl
    }


def prepare_for_openai(scraped_data):
    """
    Convert scraped data into optimal format for OpenAI
    """
    if not scraped_data:
        return None

    # Create a structured prompt
    prompt_sections = [
        f"Title: {scraped_data['title']}\nDescription: {scraped_data['description']}\nCategory: {scraped_data['category']}\n\n"
    ]

    for section in scraped_data['sections']:
        if section['type'] == 'intro':
            prompt_sections.append("Introduction:")
            for content in section['content']:
                if content['type'] == 'paragraph':
                    prompt_sections.append(f"- {content['text']}")
        else:
            # Section with heading
            heading = section.get('heading', '')
            prompt_sections.append(f"\n{heading}")

            for content in section['content']:
                if content['type'] == 'paragraph':
                    prompt_sections.append(f"- {content['text']}")
                elif content['type'] == 'list':
                    prompt_sections.append("List items:")
                    for item in content['items']:
                        prompt_sections.append(f"  • {item}")

    return "\n".join(prompt_sections)


def clean_filename_for_shell(title):
    """
    Clean filename to be shell-safe and wrap with parentheses if needed
    """
    # Remove or replace problematic characters
    clean_title = "".join(
        c for c in title if c.isalnum() or c in (' ', '-', '_', '&', '$', '!', '@', '#', '%', '^', '*', '(', ')', '+', '=', '[', ']', '{', '}', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '.', '?', '/')
    ).rstrip()

    # Replace spaces with underscores
    clean_title = clean_title.replace(' ', '_')

    # Check if filename contains shell special characters that need protection
    shell_special_chars = ['$', '!', '&', '*', '?', '[', ']',
                           '{', '}', '|', '\\', ';', '"', "'", '<', '>', '(', ')']
    needs_protection = any(char in clean_title for char in shell_special_chars)

    if needs_protection:
        # Wrap with parentheses to make it shell-safe
        clean_title = f"({clean_title})"

    return clean_title


def load_manifest():
    """Load existing manifest or create new one"""
    manifest_path = './scrapped_data/manifest.json'
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        return {
            "version": "1.0",
            "created": datetime.now().isoformat(),
            "total_posts": 0,
            "posts": {}
        }


def save_manifest(manifest):
    """Save manifest to file"""
    manifest_path = './scrapped_data/manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def is_post_scraped(manifest, blog_url, title):
    """Check if post already exists in manifest"""
    clean_title = clean_filename_for_shell(title)

    # Check by URL (most reliable)
    for post_id, post_data in manifest['posts'].items():
        if post_data.get('source_url') == blog_url or post_data.get('filename') == f"{clean_title}.txt":
            return True, post_id

    return False, None


def add_to_manifest(manifest, scraped_blog, filename):
    """Add new post to manifest"""
    post_id = f"post_{len(manifest['posts']) + 1:03d}"

    manifest['posts'][post_id] = {
        "title": scraped_blog['title'],
        "description": scraped_blog['description'],
        "category": scraped_blog['category'],
        "filename": filename,
        "source_url": f"https://blog.peppercloud.com{scraped_blog['url']}",
        "scraped_date": datetime.now().isoformat(),
        "word_count": len(prepare_for_openai(scraped_blog).split()),
        "sections_count": len(scraped_blog['sections']),
        "status": "scraped",
        "generated": False,

    }

    manifest['total_posts'] = len(manifest['posts'])
    manifest['last_updated'] = datetime.now().isoformat()

    return post_id


if __name__ == "__main__":

    tags = ['sales-and-marketing', 'crm',
            'product-update', 'grant', 'product-support']
    for tag in tags:
        print(f"🔍 Scraping PepperCloud blog for tag: {tag}")
        html_text = requests.get(
            f'https://blog.peppercloud.com/tag/{tag}/').text

        homepage = BeautifulSoup(html_text, 'lxml')

        article = homepage.find_all('article')

        for art in article:
            footer = art.find(
                'footer', class_='post-card-meta post-card-footer')
            time = footer.find('time')['datetime']
            # filter time 2 weeks from now
            two_weeks_ago = datetime.now() - timedelta(weeks=2)
            if datetime.fromisoformat(time) < two_weeks_ago:
                print("Blog post is older than 2 weeks, skipping.")
                break

            blogLink = art.find('a', class_='post-card-image-link')['href']
            scrapedBlog = scrape_pepperCloud_blog(blogLink, tag)

            if not scrapedBlog:
                print("❌ Failed to scrape blog content")
                break

            manifest = load_manifest()

            # Check if already scraped
            already_scraped, post_id = is_post_scraped(
                manifest, blogLink, scrapedBlog['title'])

            clean_title = clean_filename_for_shell(scrapedBlog['title'])
            filename = f"{clean_title}.txt"
            file_path = f"./scrapped_data/{tag}/{filename}"

            if already_scraped and os.path.exists(file_path):
                print(f"✅ Post already exists: {post_id}")
                print(f"   Title: {scrapedBlog['title']}")
                print(f"   File: {filename}")
                print(
                    f"   Originally scraped: {manifest['posts'][post_id]['scraped_date']}")
            else:
                # Prepare content and save
                aiReadyContext = prepare_for_openai(scrapedBlog)

                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(aiReadyContext)

                # Add to manifest
                new_post_id = add_to_manifest(manifest, scrapedBlog, filename)

                # Save updated manifest
                save_manifest(manifest)

                print(f"✅ New post scraped: {new_post_id}")
                print(f"   Title: {scrapedBlog['title']}")
                print(f"   File: {filename}")
                print(
                    f"   Word count: {manifest['posts'][new_post_id]['word_count']}")
                print(
                    f"   Sections: {manifest['posts'][new_post_id]['sections_count']}")

            print(f"\n📊 Manifest Summary:")
            print(f"   Total posts: {manifest['total_posts']}")
            print(f"   Manifest file: ./scrapped_data/manifest.json")
