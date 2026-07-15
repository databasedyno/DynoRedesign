import express from "express";
import Joi from "joi";
import { ICompany } from "../utils/types";

const companyMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const method = req.method;
  if (method === "GET" || method === "DELETE") {
    return next();
  }
  
  const pathname = req.path;
  const isUpdate = pathname.includes("updateCompany");
  
  // For updates, allow any valid field - don't require company_name and email
  if (isUpdate) {
    // Check if there's any data to update
    const hasData = req.body.data || req.body.company_name || req.body.email || 
                    req.body.mobile || req.body.website || req.body.address_line1 ||
                    req.body.city || req.body.state || req.body.country || 
                    req.body.zip_code || req.body.vat_number ||
                    req.body.first_name || req.body.last_name;
    
    if (!hasData) {
      return res.status(400).json({ message: "No data provided for update." });
    }
    return next();
  }
  
  // For addCompany, require company_name and email
  if (!req.body.data && !req.body.company_name && !req.body.email) {
    return res.status(400).json({ message: "Request body 'data' field or individual company fields (company_name, email) are required." });
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
          return res.status(400).json({ message: "Invalid data format. Expected JSON string or object." });
        }
      } catch (error) {
        return res.status(400).json({ message: "Invalid JSON format in 'data' field. Please check your JSON syntax." });
      }
    } else {
      // New format: Individual form fields
      parsedData = {
        company_name: req.body.company_name,
        email: req.body.email,
        mobile: req.body.mobile,
      };
    }
    
    const { company_name, email }: ICompany = parsedData;
    let validateFields;

    const pathname = req.path;
    let schema: Joi.PartialSchemaMap<any>;
    if (pathname.includes("addCompany") || pathname.includes("updateCompany")) {
      schema = {
        company_name: Joi.string().required().messages({
          "string.empty": "Company Name is Required",
        }),
        email: Joi.string().email().required().messages({
          "string.empty": "Company Email is Required",
          "string.email": "Please Enter Valid Email",
        }),
        mobile: Joi.string().optional().allow('', null).messages({
          "string.empty": "Mobile number must be a valid string",
        }),
      };
      validateFields = { company_name, email }; // Only validate required fields
    } else {
      return next();
    }

    const validationSchema = Joi.object({
      ...schema,
    });

    const validationResult = validationSchema.validate(validateFields, {
      abortEarly: false,
    });

    if (
      validationResult.error &&
      validationResult.error?.details.length !== 0
    ) {
      const errors = validationResult.error.details.map((x) => {
        return { key: x.context.key, error: x.message };
      });
      return res.status(400).json({
        message: "Please enter proper values!",
        errors,
      });
    }
    next();
  }
};

export default companyMiddleware;
