# Company Security Portal - Backend

A serverless backend API built with AWS Lambda and Node.js for the Company Security Portal, providing secure endpoints for incident management and authentication.

## 🚀 Features

- **RESTful API**: Complete CRUD operations for security incidents
- **Database Integration**: MySQL 8.0+ with connection pooling
- **Authentication**: Integration with Microsoft Azure AD
- **Notifications**: Microsoft Teams webhook integration
- **Role-based Access**: Admin and user role management
- **Data Export**: CSV export functionality
- **Serverless Architecture**: AWS Lambda for scalability

## 🛠️ Technology Stack

- **Node.js 18+** - Runtime environment
- **AWS Lambda** - Serverless compute
- **MySQL 8.0+** - Database
- **mysql2** - Database driver with connection pooling

## 📋 Prerequisites

- AWS CLI configured
- MySQL 8.0+ database server
- Node.js 18+ (for local development)
- AWS Lambda execution role with appropriate permissions

## ⚙️ Database Setup (IMPORTANT - Do This First!)

### 1. Create MySQL Database

Connect to your MySQL server and run:

```sql
CREATE DATABASE SecurityIncidentPortal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Execute Database Schema

Run the complete database schema to create all tables and initial data:

```bash
mysql -u your_username -p SecurityIncidentPortal < database/schema.sql
```

Or connect to your MySQL client and execute the contents of `database/schema.sql`.

### 3. Verify Database Setup

The schema will create:
- `requests` - Main incident reports table
- `request_comments` - Comments and updates table  
- `user_roles` - User roles and permissions
- Sample data for testing

## 🔧 Lambda Function Setup

### 1. Install Dependencies

Navigate to the lambda-package directory:

```bash
cd lambda-package
npm install
```

### 2. Configure Environment Variables

Set these environment variables in your AWS Lambda function:

```env
# Database Configuration (Required)
DB_HOST=your-mysql-host
DB_PORT=3306
DB_NAME=SecurityIncidentPortal
DB_USER=your-db-username
DB_PASSWORD=your-db-password

# Optional: Microsoft Teams Notifications
POWER_AUTOMATE_WEBHOOK_URL=your-teams-webhook-url
```

### 3. Package for Deployment

Create a deployment package:

```bash
cd lambda-package
zip -r ../lambda-deployment-package.zip .
```

### 4. Deploy to AWS Lambda

#### Option A: Using AWS CLI
```bash
aws lambda create-function \
  --function-name company-security-api \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://lambda-deployment-package.zip \
  --timeout 30 \
  --memory-size 512
```

#### Option B: Using AWS Console
1. Go to AWS Lambda Console
2. Create new function
3. Upload the `lambda-deployment-package.zip` file
4. Set handler to `index.handler`
5. Configure environment variables
6. Set timeout to 30 seconds

### 5. Configure API Gateway

1. Create a new REST API in API Gateway
2. Create resource: `/api/{proxy+}`
3. Add ANY method to handle all HTTP methods
4. Set integration type to Lambda Function
5. Enable Lambda proxy integration
6. Deploy to a stage (e.g., 'prod')

## 🔌 API Endpoints

### Health Check
```
GET /
Returns: API status and version info
```

### Security Incidents
```
POST /api/requests
Body: Incident report data
Returns: Created incident with ID

GET /api/requests?userId=USER_ID&userEmail=USER_EMAIL
Returns: List of incidents (filtered by user role)

PUT /api/requests/:id
Body: Updated incident data
Returns: Updated incident

DELETE /api/requests/:id
Returns: Success confirmation
```

### Comments
```
POST /api/requests/:id/comments
Body: Comment data
Returns: Created comment

GET /api/requests/:id/comments
Returns: List of comments for incident
```

## 🛡️ Security Features

- **Parameterized Queries**: Prevents SQL injection
- **Role-based Access**: Admin vs user permissions
- **CORS Configuration**: Properly configured cross-origin requests
- **Input Validation**: Server-side validation of all inputs
- **Error Handling**: Secure error messages (no sensitive data exposure)

## 🔧 Local Development

### Database Connection Testing
```bash
cd lambda-package
node -e "
const mysql = require('mysql2/promise');
const config = {
  host: 'localhost',
  user: 'your_user',
  password: 'your_password',
  database: 'SecurityIncidentPortal'
};
mysql.createConnection(config).then(conn => {
  console.log('✅ Database connected!');
  conn.end();
}).catch(err => console.error('❌ Database error:', err));
"
```

### Function Testing
You can test the Lambda function locally using AWS SAM or serverless frameworks.

## 📊 Database Schema Overview

### Main Tables

1. **requests** - Security incident reports
   - Stores incident details, status, priority
   - JSON fields for flexible form data storage

2. **request_comments** - Comments and updates
   - Tracks all communications on incidents
   - Supports admin and user comments

3. **user_roles** - User permissions
   - Defines admin users and their permissions
   - Role-based access control

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Timeout**
   - Check MySQL server availability
   - Verify security groups allow Lambda access
   - Increase Lambda timeout if needed

2. **Permission Errors**
   - Ensure Lambda execution role has VPC access (if MySQL in VPC)
   - Check database user permissions

3. **API Gateway 502 Errors**
   - Check Lambda function logs in CloudWatch
   - Verify handler name is correct (`index.handler`)
   - Check response format is correct

### Monitoring

- **CloudWatch Logs**: Monitor Lambda execution logs
- **CloudWatch Metrics**: Track function performance
- **API Gateway Logs**: Monitor API access patterns

## 🔄 Maintenance

### Database Backups
```bash
# Create backup
mysqldump -u username -p SecurityIncidentPortal > backup_$(date +%Y%m%d).sql

# Restore backup
mysql -u username -p SecurityIncidentPortal < backup_YYYYMMDD.sql
```

### Updating Lambda Function
```bash
cd lambda-package
zip -r ../lambda-deployment-package.zip .
aws lambda update-function-code \
  --function-name company-security-api \
  --zip-file fileb://lambda-deployment-package.zip
```

## 📞 Support

For technical support or questions, contact your IT administrator at admin@company.net.

## 📄 License

This project is proprietary software. All rights reserved.
