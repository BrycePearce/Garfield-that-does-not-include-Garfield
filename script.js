import fs from "fs";
import path from "path";
import got from "got";
import { JSDOM } from "jsdom";
import { promisify } from "util";

const sleep = promisify(setTimeout);
const BASE_URL = "https://garfieldminusgarfield.net/page/";
const COMICS_DIR = path.join(process.cwd(), "comics");

// Ensure the comics directory exists
if (!fs.existsSync(COMICS_DIR)) {
  fs.mkdirSync(COMICS_DIR);
}

// Function to check if any file from the page already exists
const pageImagesExist = (pageNum) => {
  const files = fs.readdirSync(COMICS_DIR);
  return files.some((file) => file.includes(`page${pageNum}_`));
};

// Function to download images
const downloadImage = async (url, pageNum) => {
  try {
    const filename = `page${pageNum}_${path.basename(url)}`;
    const filepath = path.join(COMICS_DIR, filename);

    if (!fs.existsSync(filepath)) {
      const response = await got(url, { responseType: "buffer" });
      fs.writeFileSync(filepath, response.body);
      console.log(`Downloaded: ${filename}`);
    } else {
      console.log(`Already downloaded: ${filename}`);
    }
  } catch (err) {
    console.error(`Failed to download image from page ${pageNum}: ${err}`);
  }
};

// Function to process each page
const processPage = async (pageNum) => {
  if (pageImagesExist(pageNum)) {
    console.log(`Images from page ${pageNum} already exist. Skipping...`);
    return true; // Skip to the next page
  }

  try {
    const response = await got(`${BASE_URL}${pageNum}`);
    const dom = new JSDOM(response.body);
    const document = dom.window.document;

    let imagesFound = 0;

    // Check for images with class 'post_media_photo image'
    const postMediaImages = document.querySelectorAll(
      "img.post_media_photo.image"
    );
    postMediaImages.forEach((img) => {
      const srcset = img.getAttribute("srcset");
      const src = img.getAttribute("src");
      const imgUrl = srcset
        ? srcset.split(",").pop().trim().split(" ")[0]
        : src;

      downloadImage(imgUrl, pageNum);
      imagesFound++;
    });

    // Check for images inside 'div.photo' (for some reason some pages have this instead)
    const photoImages = document.querySelectorAll("div.photo img");
    photoImages.forEach((img) => {
      const src = img.getAttribute("src");

      downloadImage(src, pageNum);
      imagesFound++;
    });

    if (imagesFound === 0) {
      const pageUrl = `${BASE_URL}${pageNum}`;
      console.log(`No images found on page ${pageUrl}.`);
    }

    return true;
  } catch (err) {
    if (err.response && err.response.statusCode === 404) {
      console.log(`Page ${pageNum} does not exist.`);
      return false; // Stop processing if the page does not exist
    } else {
      console.error(`Failed to process page ${pageNum}: ${err}`);
      return false; // Stop processing on other errors as well
    }
  }
};

// Main function to iterate through the pages
const main = async () => {
  let pageNum = 2;
  let keepGoing = true;

  while (keepGoing) {
    console.log(`Processing page ${pageNum}...`);
    keepGoing = await processPage(pageNum);
    pageNum++;

    // Wait 1.5 seconds between requests to be polite
    await sleep(1500);
  }

  console.log("Finished processing all pages.");
};

main();
