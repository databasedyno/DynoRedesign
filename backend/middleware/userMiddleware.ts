import express from "express";
import Joi from "joi";
import { IUserType } from "../utils/types";

const userMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const method = req.method;

  if (method === "GET") {
    return next();
  }

  let validateFields;
  let schema: Joi.PartialSchemaMap<any>;

  const pathname = req.path;
  if (req.headers["content-type"].includes("multipart/form-data")) {
    // A photo-only update sends just the file (and an empty `data`), so a
    // request with an uploaded file is valid even without name/email fields.
    const hasFile = Boolean((req as express.Request & { file?: unknown }).file);
    if (!req.body.data && !req.body.name && !req.body.email && !hasFile) {
      return res.status(400).json({ message: "Data not found! Please provide name and email." });
    } else {
      // Handle both JSON string, object, and individual field formats
      let parsedData;
      
      if (req.body.data) {
        // Old format: JSON string or object in "data" field
        try {
          if (typeof req.body.data === 'string') {
            parsedData = JSON.parse(req.body.data);
          } else if (typeof req.body.data === 'object') {
            parsedData = req.body.data;
          } else {
            return res.status(400).json({ message: "Invalid data format" });
          }
        } catch (error) {
          return res.status(400).json({ message: "Invalid JSON format in 'data' field" });
        }
      } else {
        // New format: Individual form fields
        parsedData = {
          name: req.body.name,
          email: req.body.email,
        };
      }
      
      const { name, email }: IUserType = parsedData;
      if (pathname.includes("updateUser")) {
        // Profile updates are PARTIAL (e.g. changing only the profile photo).
        // Only validate the fields actually provided — never require name/email
        // just to save a photo. (Fixes "Please enter proper values!" on photo save.)
        schema = {
          name: Joi.string().optional().allow("", null).messages({
            "string.empty": "Name is Required",
          }),
          email: Joi.string().email().optional().allow("", null).messages({
            "string.email": "Please Enter Valid Email",
          }),
        };
        validateFields = { name, email };
      }
    }
  } else {
    const { name, email, password, oldPassword, newPassword }: IUserType =
      req.body;

    if (pathname.includes("login")) {
      schema = {
        email: Joi.string().email().required().messages({
          "string.empty": "Email is Required",
          "string.email": "Please Enter Valid Email",
        }),
        password: Joi.string().required().messages({
          "string.empty": "Password is Required",
        }),
      };
      validateFields = { email, password };
    } else if (pathname.includes("changePassword")) {
      schema = {
        newPassword: Joi.string().min(8).max(128)
          .pattern(/[a-z]/, 'lowercase')
          .pattern(/[A-Z]/, 'uppercase')
          .pattern(/[0-9]/, 'digit')
          .required()
          .messages({
            "string.empty": "New Password is Required",
            "string.min": "Password must be at least 8 characters",
            "string.max": "Password must not exceed 128 characters",
            "string.pattern.name": "Password must contain at least one {#name} character",
          }),
        oldPassword: Joi.string().required().messages({
          "string.empty": "Old Password is Required",
        }),
      };
      validateFields = { newPassword, oldPassword };
    } else if (pathname.includes("registerUser")) {
      schema = {
        name: Joi.string().required().messages({
          "string.empty": "Name is Required",
        }),
        email: Joi.string().email().required().messages({
          "string.empty": "Email is Required",
          "string.email": "Please Enter Valid Email",
        }),
        password: Joi.string().min(8).max(128)
          .pattern(/[a-z]/, 'lowercase')
          .pattern(/[A-Z]/, 'uppercase')
          .pattern(/[0-9]/, 'digit')
          .required()
          .messages({
            "string.empty": "Password is Required",
            "string.min": "Password must be at least 8 characters",
            "string.max": "Password must not exceed 128 characters",
            "string.pattern.name": "Password must contain at least one {#name} character",
          }),
      };
      validateFields = { name, email, password };
    } else {
      return next();
    }
  }

  const validationSchema = Joi.object({
    ...schema,
  });

  const validationResult = validationSchema.validate(validateFields, {
    abortEarly: false,
  });

  if (validationResult.error && validationResult.error?.details.length !== 0) {
    const errors = validationResult.error.details.map((x) => {
      return { key: x.context.key, error: x.message };
    });
    return res.status(400).json({
      message: "Please enter proper values!",
      errors,
    });
  }
  next();
};

export default userMiddleware;
