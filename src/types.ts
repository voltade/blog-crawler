// Types for our scraping workflow
export interface ScrapedContent {
    type: "paragraph" | "list";
    text?: string;
    items?: string[];
}

export interface ContentSection {
    type: string;
    heading?: string;
    content: ScrapedContent[];
}

export interface ScrapedBlog {
    title: string;
    description?: string;
    category: string;
    sections: ContentSection[];
    url: string;
    sourceUrl: string;
    scrapedDate: string;
    wordCount: number;
    sectionsCount: number;
}

export interface BlogGenerationRequest {
    content: string;
    postData: {
        title: string;
        category: string;
        description?: string;
    };
}

export interface GeneratedBlog {
    title: string;
    content: string;
    filename: string;
    wordCount: number;
    generatedDate: string;
}

// Cloudflare KV interface
export interface CloudflareKV {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
}

export interface CloudflareEnv {
    SCRAPED_URLS: CloudflareKV;
    OPENAI_API_KEY: string;
}
