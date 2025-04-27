import express from 'express';
import cors from 'cors';
import logger from "morgan";
import assistantRoute from './routes/assistant.js'

const app = express();

const formatsLogger = app.get("env") === "development" ? "dev" : "short";

const allowedOrigins = ['https://victoriia-ripka.github.io', 'http://localhost:3000'];

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

app.use(cors(corsOptions));
app.use(logger(formatsLogger));
app.use(express.json());
app.use(express.static("public"));

// app.use((req, res, next) => {
//   res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
//   next();
// });

// app.use((req, res, next) => {
//   res.setHeader('Access-Control-Allow-Origin', 'https://victoriia-ripka.github.io');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
//   next();
// });


app.use("/assistant", assistantRoute);

app.use((_, res, __) => {
  res.status(404).json({
    status: "error",
    code: 404,
    message: "Use api on other routes (for example, /api/users)",
    data: "Not found",
  });
});

app.use((err, _, res, __) => {
  console.log(err.stack);
  res.status(500).json({
    status: "fail",
    code: 500,
    message: err.message,
    data: "Internal Server Error",
  });
});

export default app;