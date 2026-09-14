import sequelize from "../utils/dbInstance";
import * as models from "../models";
// fs and path imports removed - not used

const migrate = async () => {
    try {
        await sequelize.authenticate();
        console.log("Database connection established successfully.");

        console.log("Syncing models...");
        console.log("Forcing model registration...", Object.keys(models).length);
        await sequelize.sync({ alter: true });
        console.log("Models synced successfully.")

        console.log("Migration completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
};

migrate();
