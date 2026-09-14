/**
 * @swagger
 * /api/user/registerUser:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Email already exists
 *       500:
 *         description: Server error
 *
 * /api/user/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 *
 * /api/user/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset link sent (if email exists)
 *
 * /api/user/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset password with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, email, newPassword]
 *             properties:
 *               token: { type: string }
 *               email: { type: string, format: email }
 *               newPassword: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 *
 * /api/user/google-signin:
 *   post:
 *     tags: [Authentication]
 *     summary: Sign in with Google
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idToken: { type: string }
 *               accessToken: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid Google token
 */

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get dashboard statistics
 *     description: Counts include all transactions (incoming + self) with no status filter. Volumes are per-currency converted to preferred fiat.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: company_id
 *         schema: { type: integer }
 *         description: Filter by company ID
 *     responses:
 *       200:
 *         description: Dashboard data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardStats'
 *       403:
 *         description: Unauthorized
 *
 * /api/dashboard/chart:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get volume chart data
 *     description: All transactions included (no status filter). Volumes converted per-currency to preferred fiat. Response includes currency, chart_data, currency_breakdown, status_breakdown.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [7d, 30d, 90d, 1y] }
 *         description: Time period for chart
 *       - in: query
 *         name: company_id
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Chart data retrieved
 *
 * /api/dashboard/fee-tiers:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get fee tier information
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Fee tiers retrieved
 *
 * /api/dashboard/recent-transactions:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get recent transactions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Recent transactions retrieved
 */

/**
 * @swagger
 * /api/userApi/addApi:
 *   post:
 *     tags: [API Keys]
 *     summary: Create a new API key
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateApiKeyRequest'
 *     responses:
 *       200:
 *         description: API key created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKey'
 *
 * /api/userApi/getApi:
 *   get:
 *     tags: [API Keys]
 *     summary: Get all API keys
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: API keys retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ApiKey'
 *
 * /api/userApi/deleteApi/{id}:
 *   delete:
 *     tags: [API Keys]
 *     summary: Delete an API key
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: API key deleted
 */

/**
 * @swagger
 * /api/tax/rate/{countryCode}:
 *   get:
 *     tags: [Tax]
 *     summary: Get VAT rate for a country
 *     parameters:
 *       - in: path
 *         name: countryCode
 *         required: true
 *         schema: { type: string }
 *         description: 2-letter ISO country code
 *     responses:
 *       200:
 *         description: Tax rate retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaxRate'
 *
 * /api/tax/validate:
 *   post:
 *     tags: [Tax]
 *     summary: Validate a Tax ID / VAT number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tax_id, country_code]
 *             properties:
 *               tax_id: { type: string }
 *               country_code: { type: string }
 *     responses:
 *       200:
 *         description: Validation result
 *
 * /api/tax/acronyms:
 *   get:
 *     tags: [Tax]
 *     summary: Get all tax acronyms by country
 *     responses:
 *       200:
 *         description: Tax acronyms retrieved
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notifications list
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: is_read
 *         schema: { type: boolean }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notifications retrieved
 *
 * /api/notifications/preferences:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification preferences
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationPreferences'
 *   put:
 *     tags: [Notifications]
 *     summary: Update notification preferences
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationPreferences'
 *     responses:
 *       200:
 *         description: Preferences updated
 *
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notifications count
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved
 *
 * /api/notifications/{id}/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark notification as read
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *
 * /api/notifications/read-all:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */

export {};
