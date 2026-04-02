import express, { Express } from 'express';
import 'dotenv/config';
import cors from "cors";
import { AppDataSource } from "./src/data-source"
import MainRoutes from "./src/Routes/index";
import bodyParser from 'body-parser';
import morgan from 'morgan';
import { initSocket } from './src/socket/socket';
import { seedSessionTypes } from './src/seeds/sessionType.seed';

const app: Express = express();
const port = process.env.PORT || 4000;

// express config
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('tiny'))

// database connection 
AppDataSource.initialize().then(async () => {
    console.log("Data Source has been initialized! 🎈")
    const { startScheduledJobs } = await import("./src/jobs/scheduledJobs");
    startScheduledJobs();
    await seedSessionTypes();
}).catch((err) => {
    console.error("Error during Data Source initialization 🏃‍♂️:", err)
})

// config mainRoute
app.use('/api/v1', MainRoutes);

const server = app.listen(port, () => {
    console.log(`Server is running at Port :: ${port} `);
});

initSocket(server)
