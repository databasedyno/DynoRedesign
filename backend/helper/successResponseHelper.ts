import express from "express";
const successResponseHelper = (
  res: express.Response,
  statusCode: number,
  message: string,
  data?: unknown,
  totalCount?: number
) => {
  if (!data) {
    res.status(statusCode).json({ message });
  } else {
    if (totalCount) {
      res.status(statusCode).json({ message, data, totalCount });
    } else {
      res.status(statusCode).json({ message, data });
    }
  }
};

export default successResponseHelper;
