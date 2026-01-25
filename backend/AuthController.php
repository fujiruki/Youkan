<?php
// backend/AuthController.php
require_once 'db.php';
require_once 'JWTService.php';

class AuthController {
    private $pdo;

    public function __construct() {
        $this->pdo = getDB();
    }

    public function handleRequest($method, $path) {
        // /auth/login
        if (preg_match('#^/login$#', $path) && $method === 'POST') {
            $this->login();
        } 
        // /auth/register
        elseif (preg_match('#^/register$#', $path) && $method === 'POST') {
            $this->register();
        }
        // /auth/me (Verify Token)
        elseif (preg_match('#^/me$#', $path) && $method === 'GET') {
            $this->me();
        }
        else {
            http_response_code(404);
            echo json_encode(['error' => 'Auth endpoint not found']);
        }
    }

    private function register() {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validation
        $name = $input['name'] ?? $input['display_name'] ?? null;
        if (!$input || !isset($input['email']) || !isset($input['password']) || !$name) {
            http_response_code(400);
            echo json_encode(['error' => 'Name/display_name, email and password required']);
            return;
        }
        $input['name'] = $name; // normalize

        file_put_contents(__DIR__ . '/auth_debug.log', "Registering: Email=" . $input['email'] . ", Name=" . $input['name'] . ", Type=" . ($input['type'] ?? 'user') . "\n", FILE_APPEND);
        
        $type = $input['type'] ?? 'user'; // 'user', 'proprietor', 'company'

        try {
            $this->pdo->beginTransaction();

            // 1. Check if user exists
            $stmt = $this->pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$input['email']]);
            if ($stmt->fetch()) {
                file_put_contents(__DIR__ . '/auth_debug.log', "Conflict: Email already exists: " . $input['email'] . "\n", FILE_APPEND);
                $this->pdo->rollBack();
                http_response_code(409);
                echo json_encode(['error' => 'Email already registered']);
                return;
            }

            // 2. Create User
            $userId = uniqid('u_');
            $passwordHash = password_hash($input['password'], PASSWORD_DEFAULT);
            $stmt = $this->pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, datetime('now'))");
            $stmt->execute([$userId, $input['email'], $passwordHash, $input['name']]);

            // 3. Branching Logic & Personal Tenant Strategy
            // [Strategic Change] EVERY user gets a Personal Tenant ("My Life")
            $personalTenantId = uniqid('t_');
            $personalTenantName = $input['name'] . "'s Life";
            
            // Create Personal Tenant
            $stmt = $this->pdo->prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, datetime('now'))");
            $stmt->execute([$personalTenantId, $personalTenantName]);
            
            // Link as Owner
            $stmt = $this->pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES (?, ?, 'owner', datetime('now'))");
            $stmt->execute([$userId, $personalTenantId]);

            // If Company/Proprietor, create Company Tenant TOO.
            $companyTenantId = null;
            $type = $input['type'] ?? 'user';

            if ($type === 'proprietor' || $type === 'company') {
                $companyName = $input['company_name'] ?? ($input['name'] . "'s Company");
                $companyTenantId = uniqid('t_');
                
                // Create Company Tenant
                $stmt->execute([$companyTenantId, $companyName]); // Re-using prepared statement? No, prepare again to be safe/clear
                $stmt = $this->pdo->prepare("INSERT INTO tenants (id, name, type, created_at) VALUES (?, ?, 'company', datetime('now'))");
                 // Note: type column might not exist yet in schema? We didn't add it in Phase 1.
                 // db.php initDB doesn't have type. Let's stick to standard INSERT for now.
                 $stmt = $this->pdo->prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, datetime('now'))");
                 $stmt->execute([$companyTenantId, $companyName]);

                // Membership
                $stmt = $this->pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES (?, ?, 'owner', datetime('now'))");
                $stmt->execute([$userId, $companyTenantId]);
            }

            // Primary Tenant Selection for Token
            // If Company created, default to that? Or Personal?
            // User requested "Safety". Defaults to Personal is safer?
            // But business users want to start working immediately.
            // Let's default to Personal as Primary (Home), and Client switches context.
            $primaryTenantId = $personalTenantId; 
            if ($companyTenantId) {
                // $primaryTenantId = $companyTenantId; // Uncomment to default to work
            }

            $this->pdo->commit();

            // 4. Response with Token (Primary Tenant)
            $payload = [
                'sub' => $userId,
                'name' => $input['name'],
                'email' => $input['email'],
                'tenant_id' => $primaryTenantId,
                'role' => 'owner'
            ];
            $token = JWTService::encrypt($payload);

            echo json_encode([
                'token' => $token,
                'user' => ['id' => $userId, 'name' => $input['name'], 'email' => $input['email']],
                'tenant' => ['id' => $primaryTenantId, 'name' => $personalTenantName, 'role' => 'owner'],
                'company_tenant' => $companyTenantId ? ['id' => $companyTenantId] : null
            ]);
            return; // EXIT HERE to skip old logic

            /* OLD LOGIC SKIPPED */
            /*
            $tenantId = null;
            $tenantName = null;
            $role = 'owner'; // Default for creators
            
            if ($type === 'proprietor' || $type === 'company') {
            ...
            */

            // 4. Response
            if ($tenantId) {
                // Auto Login
                $payload = [
                    'sub' => $userId,
                    'name' => $input['name'],
                    'email' => $input['email'],
                    'tenant_id' => $tenantId,
                    'role' => 'owner'
                ];
                $token = JWTService::encrypt($payload);

                echo json_encode([
                    'token' => $token,
                    'user' => ['id' => $userId, 'name' => $input['name'], 'email' => $input['email']],
                    'tenant' => ['id' => $tenantId, 'name' => $tenantName, 'role' => 'owner']
                ]);
            } else {
                // User created but no tenant (Wait for invite)
                echo json_encode([
                    'message' => 'User created. Please wait for an invitation or sign in to a workspace.',
                    'user' => ['id' => $userId, 'name' => $input['name'], 'email' => $input['email']]
                ]);
            }

        } catch (Exception $e) {
            $this->pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Registration failed: ' . $e->getMessage()]);
        }
    }

    private function login() {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['email']) || !isset($input['password'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Email and password required']);
            return;
        }

        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$input['email']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($input['password'], $user['password_hash'])) {
            // Success. Fetch primary tenant.
            $stmt = $this->pdo->prepare("
                SELECT t.id, t.name, m.role 
                FROM memberships m
                JOIN tenants t ON t.id = m.tenant_id
                WHERE m.user_id = ?
                LIMIT 1
            ");
            $stmt->execute([$user['id']]);
            $tenant = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$tenant) {
                // User has no tenant (Freelancer / Waiting for invite)
                // Return token with no tenant_id
                $payload = [
                    'sub' => $user['id'],
                    'name' => $user['display_name'],
                    'email' => $user['email'],
                    'tenant_id' => null,
                    'role' => 'user'
                ];
                $token = JWTService::encrypt($payload);

                echo json_encode([
                    'token' => $token,
                    'user' => [
                        'id' => $user['id'],
                        'name' => $user['display_name'],
                        'email' => $user['email']
                    ],
                    'tenant' => null
                ]);
            } else {
                // User has tenant
                $payload = [
                    'sub' => $user['id'],
                    'name' => $user['display_name'],
                    'email' => $user['email'],
                    'tenant_id' => $tenant['id'],
                    'role' => $tenant['role']
                ];
                $token = JWTService::encrypt($payload);

                echo json_encode([
                    'token' => $token,
                    'user' => [
                        'id' => $user['id'],
                        'name' => $user['display_name'],
                        'email' => $user['email']
                    ],
                    'tenant' => [
                        'id' => $tenant['id'],
                        'name' => $tenant['name'],
                        'role' => $tenant['role']
                    ]
                ]);
            }
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
        }
    }

    private function me() {
        $token = JWTService::getBearerToken();
        $payload = $token ? JWTService::decrypt($token) : null;

        if ($payload) {
            echo json_encode(['valid' => true, 'user' => $payload]);
        } else {
            http_response_code(401);
            echo json_encode(['valid' => false, 'error' => 'Invalid or expired token']);
        }
    }
}
