import express from "express";
const errorResponseHelper = (
  res: express.Response,
  statusCode: number,
  errorMessage: string
) => {
  res.status(statusCode).json({
    success: false,
    message: errorMessage,
    statusCode,
  });
};

export default errorResponseHelper;
