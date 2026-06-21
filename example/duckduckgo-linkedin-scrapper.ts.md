
import { chromium, firefox } from 'playwright';
import fs from 'fs';


function removeSpace(str: string) {
    return str.replace(/\s+/g, '-');
}

class DuckDuckGo {
    baseURL = 'https://duckduckgo.com/?q='


    search(query: string | null = null) {
        if (query === null) {
            throw new Error("Query parameter is required")
        }
        return this.baseURL + encodeURIComponent(query)
    }


    getLinkedin(jobTitle: string = "", companyType: string = "", location: string = "") {
        if (jobTitle === "" && companyType === "" && location === "") {
            throw new Error("At least one of jobTitle, companyType, or location is required")
        }
        return this.search('site:linkedin.com/in/ ' + jobTitle + ' ' + companyType + ' ' + location)
    }

    async scrap(query = { jobTitle: "", companyType: "", location: "" }) {

        // Example usage: Searching for "Software Engineer" in "Technology" companies in "San Francisco"
        const searchUrl = this.getLinkedin(query.jobTitle, query.companyType, query.location);

        console.log(`Navigating to: ${searchUrl}`);

        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        const MAX_PAGES = 10; // Scrap first 3 pages
        let allResults: { title: string, source: string, snippet: string, snippetText: string, position: number , linkedin: string }[] = [];
        await page.goto(searchUrl);

        for (let i = 0; i < MAX_PAGES; i++) {
             if(i > 0) {
                const moreButton = await page.getByRole('button', { name: 'More results' });
                if (await moreButton.isVisible()) {
                    console.log('More results button found, clicking...');
                    await moreButton.click();
                    await page.waitForTimeout(2000);
                }
             }

            try {

                // Handle Google Consent (only on first page usually, but good to keep)
                if (i === 0) {
                    try {
                        const consentButton = await page.getByRole('button', { name: 'Accept all' }).or(page.getByRole('button', { name: 'I agree' }));
                        if (await consentButton.isVisible()) {
                            console.log('Consent popup found, clicking...');
                            await consentButton.click();
                            await page.waitForTimeout(2000);
                        }
                    } catch (e) { }
                }

                // Check for CAPTCHA
                const content = await page.innerText('body');
                if (content.includes("unusual traffic") || content.includes("not a robot")) {
                    console.log("CAPTCHA detected! Please solve it manually in the browser window.");
                    // Wait for a significant amount of time for manual solving
                    await page.waitForTimeout(30000);
                }

                // Wait for search results to load
                try {
                    await page.waitForSelector('.react-results--main', { timeout: 5000 });
                } catch (e) {
                    console.log('Search container not found even after waiting.');
                }

                // Extract search results (titles and links)
                const results = await page.evaluate(() => {
                    const items = document.querySelectorAll('.react-results--main li');
                    const data: { title: string, source: string, snippet: string, snippetText: string, position: number , linkedin: string }[] = [];

                    items.forEach((item, index) => {
                        const titleElement = item.querySelector('h2');
                        const linkElement = item.querySelector('a');
                        const linkedinLink = item.querySelector('a[href*="linkedin.com/in/"]');

                        if (titleElement && linkElement && linkedinLink) {
                            data.push({
                                title: titleElement.innerText,
                                source: linkElement.href,
                                linkedin: linkedinLink.getAttribute('href') || '',
                                snippet: item.innerHTML,
                                snippetText: item.querySelector('[data-result="snippet"]')?.innerHTML || '',
                                position: index + 1,
                            });
                        }
                    });
                    return data;
                });

                if (results.length === 0) {
                    console.log(`No results found on page ${i + 1}. Stopping.`);
                    break;
                } else {
                    console.log(`Page ${i + 1}: Scraped ${results.length} results.`);
                    allResults = results;
                }

                // Random delay between pages to mimic human behavior
                const delay = Math.floor(Math.random() * 3000) + 2000;
                console.log(`Waiting ${delay}ms before next page...`);
                await page.waitForTimeout(delay);

            } catch (error) {
                console.error(`Error scraping page ${i + 1}:`, error);
            }
        }

        console.log('Total Results:', allResults.length);
        console.log(allResults);

        // Save results to a JSON file
        fs.writeFileSync(`./out/duckduckgo/${removeSpace(query.jobTitle)}_${removeSpace(query.companyType)}_${removeSpace(query.location)}_${new Date().toISOString().replace(/:/g, '-') + Math.random().toString(36).substring(2, 5)}.json`, JSON.stringify(allResults, null, 2));

        await browser.close();

        return allResults

    }

    async enrich(){
        const files = fs.readdirSync('./out/duckduckgo');
        for (const file of files) {
            const data = JSON.parse(fs.readFileSync(`./out/duckduckgo/${file}`, 'utf8'));
            for (const item of data) {
                const name = item.title;
                const linkedin = item.link;
            }
        }
    }
}