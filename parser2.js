import axios from "axios";
import * as cheerio from "cheerio";
import { MongoClient } from "mongodb";

const mongoUrl = process.env.MONGO_URI;
const dbName = "kadikama";
let count = 1;
async function fetchCartoons() {
  let client = null;
  try {
    client = new MongoClient(mongoUrl);
    await client.connect();
    console.log("Connecting to MongoDB is successful");

    const db = client.db(dbName);
    const linksCollection = db.collection("Links");
    const multsCollection = db.collection("Cartoons");

    const urls = await linksCollection
      .find({}, { projection: { _id: 0, link: 1 } })
      .toArray();
    const dataCartoons = [];

    for (let { link } of urls) {
      try {
        console.log(`${count++} Fetching data from: ${link}`);
        if (!/^https?:\/\/\S+$/.test(link)) {
          console.error(`Invalid URL: ${link}`);
          continue;
        }

        const { data } = await axios.get(link);
        const $ = cheerio.load(data);

        $("#dle-content .full").each((index, element) => {
          const name = $(element).find(".full-title h2").text().trim();
          const origName = $(element)
            .find(".full-title .orig-name")
            .text()
            .trim();

          const imgSrc = $(element).find(".mov-img img").attr("src") || "";
          const img = imgSrc
            ? `https://kadikama.com${imgSrc}`
            : "No image available";

          const ratingKP = $(element).find(".rates .r-kp").text().trim();
          const ratingIMDB = $(element).find(".rates .r-imdb").text().trim();

          const checkList = $(element)
            .find(".mov-list li .mov-label")
            .map((_, el) => $(el).text())
            .get();
          const list = $(element)
            .find(".mov-list li .mov-desc")
            .map((_, el) => $(el).text())
            .get();

          const infoMap = {};
          checkList.forEach((label, index) => {
            infoMap[label] = list[index] || "Не указано";
          });

          const country = infoMap["Страна:"] || "Не указано";
          const age = infoMap["Возраст:"] || "Не указано";
          const genre = infoMap["Жанр:"] ? infoMap["Жанр:"].split(", ") : [];
          const year = infoMap["Год:"] || "Не указано";
          const director = infoMap["Режиссер:"]
            ? infoMap["Режиссер:"].split(", ")
            : [];
          const actors = infoMap["Актеры:"]
            ? infoMap["Актеры:"].split(", ")
            : [];

          const descList = $(element)
            .find(".mov-desc-text p")
            .map((_, el) => $(el).text())
            .get();
          const kadikamaLink = link;

          dataCartoons.push({
            name,
            origName,
            img,
            ratingKP,
            ratingIMDB,
            country,
            year,
            age,
            genre,
            director,
            actors,
            descList,
            kadikamaLink,
          });
        });

        console.log(`Processed: ${link}`);
      } catch (error) {
        console.error(`Error fetching data from ${link}:`, error.message);
      }
    }

    if (dataCartoons.length > 0) {
      for (const cartoon of dataCartoons) {
        const existingCartoon = await multsCollection.findOne({
          kadikamaLink: cartoon.kadikamaLink,
        });

        if (!existingCartoon) {
          await multsCollection.insertOne(cartoon);
          console.log(`Added new cartoon: ${cartoon.name}`);
        } else {
          console.log(`Cartoon already exists: ${cartoon.name}`);
        }
      }
    } else {
      console.log("No data to insert");
    }
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
  } finally {
    await client.close();
    console.log("MongoDB connection closed");
  }
}

fetchCartoons();
