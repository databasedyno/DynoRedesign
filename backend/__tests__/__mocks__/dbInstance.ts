// Mock Sequelize DB instance for unit tests
const sequelize = {
  query: jest.fn(),
  transaction: jest.fn(),
  define: jest.fn(),
  authenticate: jest.fn(),
};

export default sequelize;
export { sequelize };
