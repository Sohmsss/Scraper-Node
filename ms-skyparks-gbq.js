const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { addDays, format } = require("date-fns");
const fs = require("fs");
const today = new Date();
const formattedToday = format(today, "yyyy-MM-dd");
const competitor = "Skyparksecure";

async function scrapeData(driver, fromDate, toDate, airport) {

  const promoCode = "COMPARE";
  console.info(`Starting scrape for ${airport} from ${fromDate} to ${toDate}`);
  try {
    await driver.get(`https://www.skyparksecure.com/?promo=${promoCode}`);

    let dropdown = await driver.findElement(By.className("airportSelector"));
    await dropdown.click();
    const option = await driver.findElement(By.xpath(`//select[@id='airportSelectorParking']/option[contains(text(), '${airport}')]`));
    await option.click();

    await driver.executeScript(`document.getElementById('dateAairportParking').value = '${fromDate}';`);
    await driver.executeScript(`document.getElementById('dateBairportParking').value = '${toDate}';`);
    await driver.findElement(By.id("airportParkingSearch")).click();
    await driver.wait(until.elementsLocated(By.className("parking_info_block")), 20000);

    let blocks = await driver.findElements(By.className("parking_info_block"));
    let data = [];
    for (let block of blocks) {
      let productName = await block.findElement(By.tagName("h2")).getText();
      let priceText = await block.findElement(By.className("price")).getText();
      let oldPriceText;
      try {
        oldPriceText = await block.findElement(By.className("old-price")).getText();
      } catch (error) {
        oldPriceText = priceText;
      }
      let price = parseFloat(priceText.replace(/[^\d.-]/g, ''));
      let oldPrice = parseFloat(oldPriceText.replace(/[^\d.-]/g, ''));
      let discountPercentage = (oldPrice !== price) ? ((oldPrice - price) / oldPrice) * 100 : 0;
      discountPercentage = parseFloat(discountPercentage.toFixed(2));
      let searchDate = new Date().toISOString();
      data.push({
        airport,
        productName,
        fromDate,
        toDate,
        price,
        oldPrice,
        discountPercentage,
        searchDate,
        promoCode: promoCode,
        competitor
      });
    }
    console.info(`Scraping completed for ${airport} from ${fromDate} to ${toDate}`);
    return data;
  } catch (error) {
    console.error("Error during scraping:", error);
    return [];
  }
}

async function writeToCSV(data, filenamePrefix) {
  let chunkSize = 50; // Number of records per file
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunkData = data.slice(i, i + chunkSize);
    const partNum = Math.floor(i / chunkSize) + 1; // Calculate part number for filename
    const filename = `${filenamePrefix}_part${partNum}.csv`; // Updated filename with part number
    const csvWriter = createCsvWriter({
      path: filename,
      header: [
        { id: "searchDate", title: "Search_Date" },
        { id: "competitor", title: "Competitor" },
        { id: "airport", title: "Airport" },
        { id: "productName", title: "Product_Name" },
        { id: "fromDate", title: "From_Date" },
        { id: "toDate", title: "To_Date" },
        { id: "price", title: "Discounted_Price" },
        { id: "oldPrice", title: "Original_Price" },
        { id: "discountPercentage", title: "Discount_PC" },
        { id: "promoCode", title: "Promo_Code" },
      ],
      append: false, // Since we are manually managing file parts, append should always be false
    });
    await csvWriter.writeRecords(chunkData);
    console.info(`Data successfully written to ${filename}`);
  }
}


async function main() {
    let options = new chrome.Options().addArguments("--headless", "--no-sandbox", "--disable-dev-shm-usage");
    let driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();

  
    try {
      await driver.get('https://www.skyparksecure.com/');
      // const cookiesButton = await driver.wait(until.elementLocated(By.id("onetrust-accept-btn-handler")), 10000);
      //await cookiesButton.click();
      // console.log("Accepted cookies");
  
      const airports = [
        // Reference airports
        //"Birmingham", "Bristol", "East Midlands", "Edinburgh", "Gatwick", "Heathrow",
        //"Leeds Bradford", "Liverpool", "Luton", "Manchester", "Newcastle", "Southampton", "Stansted"
        "Manchester","Stansted","East Midlands", "Gatwick", "Heathrow", "Luton", "Birmingham", "Bristol", "Edinburgh", "Leeds Bradford", "Liverpool", "Newcastle"]
      for (const airport of airports) {
        let allData = [];
        for (let i = 1; i <= 90; i++) {
          const fromDate = addDays(new Date(), i);
          const toDate = addDays(fromDate, 7);
          const formattedFromDate = format(fromDate, "yyyy-MM-dd");
          const formattedToDate = format(toDate, "yyyy-MM-dd");
          console.log(`Scraping data for dates ${formattedFromDate} to ${formattedToDate}`);
          const data = await scrapeData(driver, formattedFromDate, formattedToDate, airport);
          allData.push(...data);
        }
    const filenamePrefix = `Skyparks_${airport}_${formattedToday}_parking_data`; // Prefix for filename
    await writeToCSV(allData, filenamePrefix);      }
    } catch (error) {
      console.error("Encountered an error", error);
    } finally {
      await driver.quit();
    }
  }
  
  main();