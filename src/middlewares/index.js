import express from 'express';
import cors from 'cors';
import logger from 'morgan';
import bodyParser from 'body-parser'


const applyMiddlewares = (app) => {
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(express.json());
  app.use(logger('common'));
};

export default applyMiddlewares;
