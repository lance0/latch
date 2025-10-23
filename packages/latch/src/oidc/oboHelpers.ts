import { NextRequest } from 'next/server';
import { exchangeTokenOnBehalfOf } from './obo';
import { extractBearerToken } from './accessTokenValidation';
import { getLatchConfig, getAzureEndpoints } from '../config';
import { LatchError } from '../types';

/**
 * Get OBO token for Microsoft Graph API
 *
 * Convenience helper for the most common OBO scenario: calling Microsoft Graph
 * on behalf of the authenticated user.
 *
 * @param request - Next.js request object with Authorization header
 * @param options - OBO options
 * @returns Access token for Microsoft Graph
 *
 * @throws {LatchError} LATCH_OBO_INVALID_ASSERTION - No bearer token in request
 * @throws {LatchError} LATCH_OBO_EXCHANGE_FAILED - Token exchange failed
 *
 * @example
 * // In your API route:
 * export async function GET(request: NextRequest) {
 *   const graphToken = await oboTokenForGraph(request, {
 *     scopes: ['User.Read', 'Mail.Read']
 *   });
 *
 *   const response = await fetch('https://graph.microsoft.us/v1.0/me', {
 *     headers: { Authorization: `Bearer ${graphToken}` }
 *   });
 *
 *   return Response.json(await response.json());
 * }
 */
export async function oboTokenForGraph(
  request: NextRequest,
  options?: {
    /** Microsoft Graph scopes (default: ["User.Read"]) */
    scopes?: string[];

    /** Custom token extractor (default: extracts from Authorization header) */
    extractToken?: (req: NextRequest) => string | null;
  }
): Promise<string> {
  const config = getLatchConfig();
  const endpoints = getAzureEndpoints(config.cloud, config.tenantId);

  // Extract bearer token
  const extractor = options?.extractToken || defaultTokenExtractor;
  const userAssertion = extractor(request);

  if (!userAssertion) {
    throw new LatchError(
      'LATCH_OBO_INVALID_ASSERTION',
      'No bearer token found in Authorization header. ' +
        'Ensure your API route is protected and receives a bearer token.'
    );
  }

  // Build Graph scopes with correct resource
  const graphResource = `${endpoints.graphBaseUrl}/.default`;
  const scopes = options?.scopes
    ? options.scopes.map((s) => {
        // If scope is already fully qualified (contains /) or is .default, use as-is
        if (s.includes('/') || s === '.default') return s;
        // Otherwise, prepend Graph URL
        return `${endpoints.graphBaseUrl}/${s}`;
      })
    : [graphResource];

  // Exchange token
  const oboResponse = await exchangeTokenOnBehalfOf({
    userAssertion,
    clientId: config.clientId,
    tenantId: config.tenantId,
    cloud: config.cloud,
    clientAuth: {
      clientSecret: config.clientSecret,
      certificate: config.clientCertificate,
    },
    scopes,
    allowedAudiences: config.allowedAudiences,
    cacheOptions: config.oboCache,
  });

  return oboResponse.access_token;
}

/**
 * Get OBO token for a custom downstream API
 *
 * Use this for calling your own or third-party APIs that are registered in Azure AD.
 *
 * @param request - Next.js request object with Authorization header
 * @param options - OBO options
 * @returns Access token for downstream API
 *
 * @throws {LatchError} LATCH_OBO_INVALID_ASSERTION - No bearer token in request
 * @throws {LatchError} LATCH_OBO_EXCHANGE_FAILED - Token exchange failed
 *
 * @example
 * // Call your downstream API:
 * export async function GET(request: NextRequest) {
 *   const apiToken = await oboTokenForApi(request, {
 *     audience: 'api://my-downstream-api',
 *     scopes: ['api://my-downstream-api/.default']
 *   });
 *
 *   const response = await fetch('https://my-api.example.com/data', {
 *     headers: { Authorization: `Bearer ${apiToken}` }
 *   });
 *
 *   return Response.json(await response.json());
 * }
 */
export async function oboTokenForApi(
  request: NextRequest,
  options: {
    /**
     * Downstream API audience
     * Can be:
     * - App ID URI: "api://your-api"
     * - Client ID: "00000000-0000-0000-0000-000000000000"
     */
    audience: string;

    /**
     * Requested scopes for downstream API
     * Default: [audience + "/.default"]
     *
     * Examples:
     * - ["api://downstream/.default"] - All delegated permissions
     * - ["api://downstream/Read", "api://downstream/Write"] - Specific permissions
     */
    scopes?: string[];

    /** Custom token extractor (default: extracts from Authorization header) */
    extractToken?: (req: NextRequest) => string | null;
  }
): Promise<string> {
  const config = getLatchConfig();

  // Extract bearer token
  const extractor = options.extractToken || defaultTokenExtractor;
  const userAssertion = extractor(request);

  if (!userAssertion) {
    throw new LatchError(
      'LATCH_OBO_INVALID_ASSERTION',
      'No bearer token found in Authorization header. ' +
        'Ensure your API route is protected and receives a bearer token.'
    );
  }

  // Use provided scopes or default to /.default
  const scopes = options.scopes || [`${options.audience}/.default`];

  // Exchange token
  const oboResponse = await exchangeTokenOnBehalfOf({
    userAssertion,
    clientId: config.clientId,
    tenantId: config.tenantId,
    cloud: config.cloud,
    clientAuth: {
      clientSecret: config.clientSecret,
      certificate: config.clientCertificate,
    },
    scopes,
    allowedAudiences: config.allowedAudiences,
    cacheOptions: config.oboCache,
  });

  return oboResponse.access_token;
}

/**
 * Get OBO token for Azure Function
 *
 * Azure Functions can be protected in two ways:
 * 1. **Easy Auth** - Built-in authentication (audience is the Function App)
 * 2. **App Registration** - Custom Azure AD app (audience is the app's client ID)
 *
 * @param request - Next.js request object with Authorization header
 * @param options - OBO options
 * @returns Access token for Azure Function
 *
 * @throws {LatchError} LATCH_OBO_INVALID_ASSERTION - No bearer token in request
 * @throws {LatchError} LATCH_OBO_EXCHANGE_FAILED - Token exchange failed
 *
 * @example
 * // Easy Auth-protected Function:
 * export async function POST(request: NextRequest) {
 *   const functionToken = await oboTokenForFunction(request, {
 *     functionAppId: 'your-function-app-client-id',
 *     functionType: 'easy-auth'
 *   });
 *
 *   const response = await fetch(
 *     'https://my-func.azurewebsites.us/api/process',
 *     {
 *       method: 'POST',
 *       headers: { Authorization: `Bearer ${functionToken}` },
 *       body: JSON.stringify({ data: '...' })
 *     }
 *   );
 *
 *   return Response.json(await response.json());
 * }
 *
 * @example
 * // App Registration-protected Function:
 * export async function POST(request: NextRequest) {
 *   const functionToken = await oboTokenForFunction(request, {
 *     functionAppId: 'api://my-function-api',
 *     functionType: 'app-registration',
 *     scopes: ['api://my-function-api/.default']
 *   });
 *
 *   // ... call Function
 * }
 */
export async function oboTokenForFunction(
  request: NextRequest,
  options: {
    /**
     * Azure Function App's client ID or App ID URI
     * - For Easy Auth: The Function App's client ID from Azure portal
     * - For App Registration: The custom app's client ID or App ID URI
     */
    functionAppId: string;

    /**
     * Function authentication type
     * - "easy-auth": Built-in Azure App Service authentication
     * - "app-registration": Custom Azure AD app registration
     */
    functionType: 'easy-auth' | 'app-registration';

    /**
     * Requested scopes
     * Default: [functionAppId + "/.default"]
     */
    scopes?: string[];

    /** Custom token extractor (default: extracts from Authorization header) */
    extractToken?: (req: NextRequest) => string | null;
  }
): Promise<string> {
  const config = getLatchConfig();

  // Extract bearer token
  const extractor = options.extractToken || defaultTokenExtractor;
  const userAssertion = extractor(request);

  if (!userAssertion) {
    throw new LatchError(
      'LATCH_OBO_INVALID_ASSERTION',
      'No bearer token found in Authorization header. ' +
        'Ensure your API route is protected and receives a bearer token.'
    );
  }

  // Build scopes based on function type
  let scopes: string[];
  if (options.scopes) {
    scopes = options.scopes;
  } else {
    // Default: use /.default for the function app ID
    const audience =
      options.functionType === 'easy-auth'
        ? options.functionAppId // Easy Auth uses client ID directly
        : options.functionAppId; // App Registration uses app ID URI or client ID

    scopes = [`${audience}/.default`];
  }

  // Exchange token
  const oboResponse = await exchangeTokenOnBehalfOf({
    userAssertion,
    clientId: config.clientId,
    tenantId: config.tenantId,
    cloud: config.cloud,
    clientAuth: {
      clientSecret: config.clientSecret,
      certificate: config.clientCertificate,
    },
    scopes,
    allowedAudiences: config.allowedAudiences,
    cacheOptions: config.oboCache,
  });

  return oboResponse.access_token;
}

/**
 * Default token extractor - extracts bearer token from Authorization header
 */
function defaultTokenExtractor(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  return extractBearerToken(authHeader);
}
