import dotenv from "dotenv";
import dbConnect from "./db/index.js";
import { app } from "./app.js";

const port = process.env.PORT || 8000;

dbConnect()
  .then(() => {
    app.on("error", (error) => {
      console.log(`ERROR: ${error}`);
    });

    app.listen(port, () => {
      console.log(`⚙️ Server connected at port : ${port}`);
    });
  })
  .catch((error) => {
    console.log(`MongoDB Connection failed!!! ERROR: ${error}`);
  });

dotenv.config({
  path: "./env",
});

/*

import express from "express";
const app = express();

(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    app.on("error", (error) => {
      console.log("ERROR: ", error);
      throw error;
    });

    app.listen(process.env.PORT, () => {
      console.log("App listening on port : ", process.env.PORT);
    });
  } catch (error) {
    console.error("ERROR: ", error);
    throw error;
  }
})();

*/
