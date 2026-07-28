import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import { App } from '../server/app.ts';

const application = new App();
const expressApp = application.app;

export default expressApp;
