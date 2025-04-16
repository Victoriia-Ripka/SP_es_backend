import dotenv from "dotenv";
import mongoose from "mongoose";

import app from "./app.js";

dotenv.config();

const DB = process.env.DB_HOST;
const PORT = process.env.PORT || 8080;

mongoose.Promise = global.Promise;
mongoose.set("strictQuery", true);
const connection = mongoose.connect(DB);

connection.then(() => app.listen(PORT, () => {
      console.log("Server running. Use our API on port: ", PORT);
      console.log("Database connection successful");
    })
  ).catch((error) => {
    console.log(error.message);
    process.exit(1);
  });