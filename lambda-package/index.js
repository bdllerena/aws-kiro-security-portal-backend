// index.js - Main Lambda handler (clean version)
const mysql = require('mysql2/promise');

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  charset: 'utf8mb4',
  timezone: 'Z',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  connectionLimit: 1,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
};

let pool = null;

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
};

const executeQuery = async (sql, params = []) => {
  const connection = getPool();
  try {
    console.log('🔍 Executing SQL:', sql.substring(0, 100) + (sql.length > 100 ? '...' : ''));
    const [rows] = await connection.execute(sql, params);
    console.log('✅ Query executed successfully, rows:', Array.isArray(rows) ? rows.length : rows.affectedRows || 0);
    return rows;
  } catch (error) {
    console.error('❌ Database query failed:', error);
    throw error;
  }
};

const generateRequestId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `REQ-${timestamp}-${randomStr}`.toUpperCase();
};

const generateCommentId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `CMT-${timestamp}-${randomStr}`.toUpperCase();
};

const parseJSON = (jsonString) => {
  if (!jsonString) return null;
  try {
    return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch (error) {
    console.warn('Failed to parse JSON:', jsonString);
    return null;
  }
};

const isITTeamMember = (email) => {
  const IT_TEAM_EMAILS = [
    'john.smith@company.net',
    'admin@company.net'
  ];
  return IT_TEAM_EMAILS.includes(email?.toLowerCase());
};

const sendTeamsNotification = async (reportData) => {
  const POWER_AUTOMATE_URL = process.env.POWER_AUTOMATE_WEBHOOK_URL;

  console.log('🔍 Checking Power Automate configuration...');
  console.log('Environment variable set:', !!POWER_AUTOMATE_URL);
  console.log('URL length:', POWER_AUTOMATE_URL ? POWER_AUTOMATE_URL.length : 0);

  if (!POWER_AUTOMATE_URL) {
    console.log('❌ Power Automate webhook URL not configured, skipping notification');
    return;
  }

  console.log('📤 Sending notification for report:', reportData.requestId);

  const severityEmojis = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
    critical: '🚨'
  };

  const incidentTypeEmojis = {
    'phishing-email': '📧',
    'suspicious-website': '🌐',
    'social-engineering': '👥',
    'malware': '🦠',
    'data-breach': '🔓',
    'identity-theft': '🆔',
    'other': '❓'
  };

  // Send structured data to Power Automate with attachments array
  const payload = {
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              text: `${severityEmojis[reportData.severity]} New Security Incident Report`,
              weight: "Bolder",
              size: "Large"
            },
            {
              type: "TextBlock",
              text: `Report ID: ${reportData.requestId}`,
              weight: "Bolder"
            },
            {
              type: "FactSet",
              facts: [
                { title: "Reporter", value: `${reportData.userInfo?.name || 'Unknown'} (${reportData.userInfo?.email || 'N/A'})` },
                { title: "Department", value: reportData.userInfo?.department || 'Not specified' },
                { title: "Incident Type", value: `${incidentTypeEmojis[reportData.formData?.incidentType] || '🛡️'} ${(reportData.formData?.incidentType || reportData.type)?.replace('-', ' ')}` },
                { title: "Severity", value: `${severityEmojis[reportData.severity]} ${reportData.severity?.toUpperCase()}` },
                { title: "Subject", value: reportData.formData?.subject || reportData.reason },
                { title: "Date Occurred", value: reportData.formData?.dateOccurred || 'Not specified' }
              ]
            },
            {
              type: "TextBlock",
              text: "**Description:**",
              weight: "Bolder"
            },
            {
              type: "TextBlock",
              text: (reportData.formData?.description || 'No description provided').substring(0, 200),
              wrap: true
            }
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "View Dashboard",
              url: "https://company-security-portal.company.net/"
            }
          ]
        }
      }
    ],
    // Flat data for Power Automate processing
    reportId: reportData.requestId,
    severity: reportData.severity,
    subject: reportData.formData?.subject || reportData.reason,
    reporterName: reportData.userInfo?.name || 'Unknown',
    reporterEmail: reportData.userInfo?.email || 'N/A'
  };

  try {
    console.log('📡 Making request to Power Automate...');
    console.log('Payload size:', JSON.stringify(payload).length, 'bytes');

    const response = await fetch(POWER_AUTOMATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('📨 Response status:', response.status);
    console.log('📨 Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const responseText = await response.text();
      console.log('✅ Power Automate notification sent successfully');
      console.log('Response:', responseText);
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to send Power Automate notification:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ Error sending Power Automate notification:', error.message);
    console.error('Stack trace:', error.stack);
  }
};

exports.handler = async (event, context) => {
  console.log('🚀 Company API Lambda called');
  console.log('📝 Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  try {
    // Handle CORS preflight
    if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }

    // Extract path and method
    const path = event.path || event.rawPath || event.requestContext?.http?.path || '/health';
    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

    console.log(`🔍 Request: ${method} ${path}`);

    // Health check
    if (path === '/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'OK',
          message: 'Company Security Portal API is running!',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        })
      };
    }

    // Test Teams notification
    if (path === '/test-teams' && method === 'POST') {
      console.log('🧪 Testing Teams notification...');
      await sendTeamsNotification({
        requestId: 'TEST-' + Date.now(),
        severity: 'high',
        formData: {
          subject: 'Test notification from Lambda',
          description: 'This is a test notification',
          incidentType: 'phishing-email'
        },
        userInfo: {
          name: 'Test User',
          email: 'test@test.com',
          department: 'IT'
        },
        type: 'phishing-email',
        reason: 'Testing Teams integration'
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Test notification sent, check logs' })
      };
    }

    // Get user role
    if (path === '/api/auth/user-role' && method === 'GET') {
      try {
        // Get email from query parameters
        let userEmail = event.queryStringParameters?.email;
        
        if (!userEmail) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: 'Bad Request',
              message: 'Email is required for user role determination'
            })
          };
        }

        console.log('Determining role for email:', userEmail);

        // Try to get role from database first
        const query = 'SELECT user_role, permissions FROM user_roles WHERE email = ?';
        const result = await executeQuery(query, [userEmail.toLowerCase()]);
        
        let role, permissions;
        
        if (result && result.length > 0) {
          console.log('Found user in database:', result[0]);
          role = result[0].user_role;
          
          // Handle permissions parsing with error handling
          try {
            const permissionsData = result[0].permissions;
            console.log('Raw permissions data:', permissionsData, 'Type:', typeof permissionsData);
            
            if (typeof permissionsData === 'string') {
              permissions = JSON.parse(permissionsData);
            } else if (Array.isArray(permissionsData)) {
              permissions = permissionsData;
            } else {
              console.log('Unexpected permissions format, using default');
              permissions = ['request:create', 'request:view-own'];
            }
          } catch (parseError) {
            console.error('Error parsing permissions JSON:', parseError.message);
            console.error('Raw permissions data:', result[0].permissions);
            
            // Fallback based on role
            if (role === 'admin') {
              permissions = ['request:create', 'request:view-own', 'request:view-all', 'request:approve', 'request:assign', 'request:delete', 'notification:send', 'user:manage', 'analytics:view'];
            } else if (role === 'it-support') {
              permissions = ['request:create', 'request:view-own', 'request:view-all', 'request:approve', 'request:assign', 'notification:send', 'analytics:view'];
            } else {
              permissions = ['request:create', 'request:view-own'];
            }
          }
        } else {
          console.log('User not found in database, assigning default role');
          role = 'user';
          permissions = ['request:create', 'request:view-own'];
        }

        const userInfo = {
          userId: `user-${Date.now()}`,
          email: userEmail,
          name: 'Unknown User',
          role,
          permissions,
          isITTeam: role === 'it-support' || role === 'admin',
          isAdmin: role === 'admin'
        };

        console.log('Final user info:', userInfo);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            user: userInfo,
            roles: {
              USER: 'user',
              IT_SUPPORT: 'it-support', 
              ADMIN: 'admin'
            }
          })
        };

      } catch (error) {
        console.error('Error determining user role:', error);
        
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Internal server error',
            message: error.message
          })
        };
      }
    }

    // Get all requests
    if (path === '/api/requests' && method === 'GET') {
      const userId = event.queryStringParameters?.userId || 'test-user-123';
      const userEmail = event.queryStringParameters?.userEmail || 'john.smith@company.net';
      const isITUser = isITTeamMember(userEmail);

      let sql = `
        SELECT r.*, 
               JSON_ARRAYAGG(
                 CASE WHEN c.id IS NOT NULL THEN
                   JSON_OBJECT(
                     'id', c.id,
                     'userId', c.user_id,
                     'userName', c.user_name,
                     'message', c.message,
                     'timestamp', c.created_at,
                     'isInternal', c.is_internal
                   )
                 ELSE NULL END
               ) as comments
        FROM requests r
        LEFT JOIN request_comments c ON r.id = c.request_id
      `;

      let params = [];
      if (!isITUser) {
        sql += ' WHERE r.user_id = ?';
        params.push(userId);
      }

      sql += ' GROUP BY r.id ORDER BY r.created_at DESC';

      const rows = await executeQuery(sql, params);

      const requests = rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        userInfo: parseJSON(row.user_info),
        formData: parseJSON(row.form_data),
        type: row.request_type,
        details: parseJSON(row.details),
        reason: row.reason,
        status: row.request_status,
        priority: row.priority_level,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        comments: row.comments ? parseJSON(row.comments).filter(c => c !== null) : [],
        isSecurityIncident: true,
        severity: parseJSON(row.form_data)?.severity || row.priority_level
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          requests,
          count: requests.length
        })
      };
    }

    // Create request
    if (path === '/api/requests' && method === 'POST') {
      const requestData = JSON.parse(event.body);
      const userId = requestData.userId || 'test-user-123';

      if (!requestData.userInfo || !requestData.type || !requestData.reason) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Missing required fields: userInfo, type, reason'
          })
        };
      }

      const now = new Date();
      const requestId = generateRequestId();

      let priority = 'medium';
      if (requestData.formData?.severity) {
        const severityToPriority = {
          'low': 'low',
          'medium': 'medium',
          'high': 'high',
          'critical': 'critical'
        };
        priority = severityToPriority[requestData.formData.severity] || 'medium';
      }

      const sql = `
        INSERT INTO requests (
          id, user_id, user_info, form_data, request_type, details, reason, 
          request_status, priority_level, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        requestId,
        userId,
        JSON.stringify(requestData.userInfo),
        JSON.stringify(requestData.formData || {}),
        requestData.type,
        JSON.stringify(requestData.details || {}),
        requestData.reason,
        'open',
        priority,
        now.toISOString(),
        now.toISOString()
      ];

      await executeQuery(sql, params);

      // Send Teams notification
      await sendTeamsNotification({
        requestId,
        userInfo: requestData.userInfo,
        formData: requestData.formData,
        severity: priority,
        type: requestData.type,
        reason: requestData.reason
      });

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          message: 'Security report created successfully',
          request: {
            id: requestId,
            userId: userId,
            userInfo: requestData.userInfo,
            formData: requestData.formData,
            type: requestData.type,
            details: requestData.details,
            reason: requestData.reason,
            status: 'open',
            priority: priority,
            createdAt: now.toISOString(),
            isSecurityIncident: true
          }
        })
      };
    }

    // Get request stats
    if (path === '/api/requests/stats' && method === 'GET') {
      const sql = 'SELECT * FROM request_stats';
      const [stats] = await executeQuery(sql);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          statistics: stats || {
            total: 0,
            open: 0,
            'in-progress': 0,
            resolved: 0,
            closed: 0
          }
        })
      };
    }

    // Update request status
    if (path.match(/^\/api\/requests\/[^\/]+\/status$/) && method === 'PUT') {
      const pathMatch = path.match(/\/api\/requests\/([^\/]+)\/status$/);
      const requestId = pathMatch[1];
      const updateData = JSON.parse(event.body);

      console.log('🔄 Updating request status:', requestId, updateData);

      if (!updateData.status) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Status is required' })
        };
      }

      const now = new Date().toISOString();

      // Update request status
      const updateSql = 'UPDATE requests SET request_status = ?, updated_at = ? WHERE id = ?';
      const updateParams = [updateData.status, now, requestId];
      await executeQuery(updateSql, updateParams);

      // Add investigation notes as comment if provided
      if (updateData.notes && updateData.notes.trim()) {
        console.log('📝 Adding investigation notes as comment:', updateData.notes);
        const commentId = generateCommentId();
        const commentSql = `
          INSERT INTO request_comments (id, request_id, user_id, user_name, message, is_internal, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const commentParams = [
          commentId,
          requestId,
          updateData.updatedBy || 'admin',
          'IT Admin', // You can make this dynamic based on user
          `Status changed to ${updateData.status}. Notes: ${updateData.notes}`,
          updateData.isInternal || false,
          now
        ];

        console.log('💾 Inserting comment with params:', commentParams);
        await executeQuery(commentSql, commentParams);
        console.log('✅ Comment inserted successfully');
      } else {
        console.log('⚠️ No notes provided or notes empty:', updateData.notes);
      }

      // Fetch and return the updated request with comments
      const fetchSql = `
        SELECT r.*, 
               JSON_ARRAYAGG(
                 CASE WHEN c.id IS NOT NULL THEN
                   JSON_OBJECT(
                     'id', c.id,
                     'userId', c.user_id,
                     'userName', c.user_name,
                     'message', c.message,
                     'timestamp', c.created_at,
                     'isInternal', c.is_internal
                   )
                 ELSE NULL END
               ) as comments
        FROM requests r
        LEFT JOIN request_comments c ON r.id = c.request_id
        WHERE r.id = ?
        GROUP BY r.id
      `;

      const [updatedRequest] = await executeQuery(fetchSql, [requestId]);

      if (!updatedRequest) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Request not found' })
        };
      }

      // Transform the data to match frontend expectations
      const comments = updatedRequest.comments ? parseJSON(updatedRequest.comments).filter(c => c !== null) : [];
      console.log('📋 Raw comments from DB:', updatedRequest.comments);
      console.log('🔍 Parsed comments:', comments);

      const transformedRequest = {
        id: updatedRequest.id,
        userId: updatedRequest.user_id,
        userInfo: parseJSON(updatedRequest.user_info),
        formData: parseJSON(updatedRequest.form_data),
        type: updatedRequest.request_type,
        details: parseJSON(updatedRequest.details),
        reason: updatedRequest.reason,
        status: updatedRequest.request_status,
        priority: updatedRequest.priority_level,
        createdAt: updatedRequest.created_at,
        updatedAt: updatedRequest.updated_at,
        comments: comments,
        isSecurityIncident: true,
        severity: parseJSON(updatedRequest.form_data)?.severity || updatedRequest.priority_level
      };

      console.log('📤 Returning transformed request with comments:', transformedRequest.comments);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Request status updated successfully',
          request: transformedRequest
        })
      };
    }

    // 404 - Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: 'Not Found',
        message: `Route ${method} ${path} not found`
      })
    };

  } catch (error) {
    console.error('❌ Lambda error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};