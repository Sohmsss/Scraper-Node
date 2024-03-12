const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { addDays, format } = require("date-fns");
const fs = require("fs");
const today = new Date();
const formattedToday = format(today, "yyyy-MM-dd");

async function scrapeData(driver, fromDate, toDate, airport) {

  const promoCode = "WJ379";
  console.info(`Starting scrape for ${airport} from ${fromDate} to ${toDate}`);
  try {

    let url = await driver.get(`https://www.holidayextras.com/static/?selectProduct=cp&#/carpark?agent=${promoCode}&ppts=&customer_ref=&lang=en&launch_id=56780932919057&campaign_id=61386&adults=2&depart=${airport}&terminal=&arrive=&flight=W95708&in=${fromDate}&out=${toDate}&park_from=12%3A00&park_to=13%3A00&children=0&infants=0&from_categories=true`);

    console.log(url)
    
    await driver.wait(until.elementsLocated(By.className("product-item")), 20000);

    let blocks = await driver.findElements(By.className("product-item"));
    let data = [];
    for (let block of blocks) {
      let productName = await block.findElement(By.className("product-title")).getText();
      let priceText = await block.findElement(By.className("css-1lxbtr9")).getText();
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
        promoCode: promoCode
      });
    }
    console.info(`Scraping completed for ${airport} from ${fromDate} to ${toDate}`);
    return data;
  } catch (error) {
    console.error("Error during scraping:", error);
    return [];
  }
}

async function writeToCSV(data, filename) {
  const csvWriter = createCsvWriter({
    path: filename,
    header: [
      { id: "searchDate", title: "Search Date" },
      { id: "airport", title: "Airport" },
      { id: "productName", title: "Product Name" },
      { id: "fromDate", title: "From Date" },
      { id: "toDate", title: "To Date" },
      { id: "price", title: "Discounted Price" },
      { id: "oldPrice", title: "Original Price" },
      { id: "discountPercentage", title: "Discount %" },
      { id: "promoCode", title: "Promo Code" },
    ],
    append: fs.existsSync(filename),
  });
  await csvWriter.writeRecords(data);
  console.info(`Data successfully written to ${filename}`);
}

async function main() {
    let options = new chrome.Options().addArguments("--headless", "--no-sandbox", "--disable-dev-shm-usage");
    let driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  
    try {
      
      const airports = [
        // Reference airports
        //"Birmingham", "Bristol", "East Midlands", "Edinburgh", "Gatwick", "Heathrow",
        //"Leeds Bradford", "Liverpool", "Luton", "Manchester", "Newcastle", "Southampton", "Stansted"
        "MAN","STN","EMA"]
      for (const airport of airports) {
        let allData = [];
        for (let i = 1; i <= 5; i++) {
          const fromDate = addDays(new Date(), i);
          const toDate = addDays(fromDate, 7);
          const formattedFromDate = format(fromDate, "yyyy-MM-dd");
          const formattedToDate = format(toDate, "yyyy-MM-dd");
          console.log(`Scraping data for dates ${formattedFromDate} to ${formattedToDate}`);
          const data = await scrapeData(driver, formattedFromDate, formattedToDate, airport);
          allData.push(...data);
        }
        const filename = `HX ${airport}_${formattedToday}_parking_data.csv`;
        await writeToCSV(allData, filename);
      }
    } catch (error) {
      console.error("Encountered an error", error);
    } finally {
      await driver.quit();
    }
  }
  
  main();