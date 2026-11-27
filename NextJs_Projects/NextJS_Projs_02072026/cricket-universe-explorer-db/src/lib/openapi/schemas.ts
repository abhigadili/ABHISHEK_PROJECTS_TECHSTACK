import type { OpenAPIV3 } from 'openapi-types'

export const schemas: Record<string, OpenAPIV3.SchemaObject> = {
  AuthUser: {
    type: 'object',
    properties: {
      id: { type: 'string', example: '1' },
      name: { type: 'string', example: 'Admin User' },
      email: { type: 'string', format: 'email', example: 'admin@cricket.com' },
      role: { type: 'string', enum: ['user', 'admin'], example: 'admin' },
    },
    required: ['id', 'name', 'email', 'role'],
  },

  Country: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'india' },
      name: { type: 'string', example: 'India' },
      shortName: { type: 'string', example: 'IND' },
      flag: { type: 'string', example: '🇮🇳' },
      description: { type: 'string', example: 'The home of cricket legends.' },
      background: { type: 'string', example: '/images/india-bg.jpg' },
      established: { type: 'string', example: '1928' },
      worldCupsWon: { type: 'number', example: 2 },
      board: { type: 'string', example: 'BCCI' },
      coach: { type: 'string', example: 'Gautam Gambhir' },
      captain: { type: 'string', example: 'Rohit Sharma' },
      famousPlayers: {
        type: 'array',
        items: { type: 'string' },
        example: ['Sachin Tendulkar', 'MS Dhoni'],
      },
    },
    required: ['id', 'name', 'shortName'],
  },

  League: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'ipl' },
      countryId: { type: 'string', example: 'india' },
      name: { type: 'string', example: 'Indian Premier League' },
      description: { type: 'string', example: 'Premier T20 franchise tournament.' },
      established: { type: 'string', example: '2008' },
      format: {
        type: 'string',
        enum: ['Test', 'ODI', 'T20', 'First-Class', 'List-A'],
        example: 'T20',
      },
      trophy: { type: 'string', example: '/images/ipl-trophy.jpg' },
      image: { type: 'string', example: '/images/ipl.jpg' },
    },
    required: ['id', 'countryId', 'name'],
  },

  Team: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'mi' },
      leagueId: { type: 'string', example: 'ipl' },
      name: { type: 'string', example: 'Mumbai Indians' },
      captain: { type: 'string', example: 'Hardik Pandya' },
      coach: { type: 'string', example: 'Mark Boucher' },
      homeGround: { type: 'string', example: 'Wankhede Stadium' },
      titles: { type: 'number', example: 5 },
      logo: { type: 'string', example: '/images/mi-logo.png' },
      description: { type: 'string', example: 'Five-time IPL champions.' },
    },
    required: ['id', 'leagueId', 'name'],
  },

  Cricketer: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'rohit-sharma' },
      teamId: { type: 'string', example: 'mi' },
      name: { type: 'string', example: 'Rohit Sharma' },
      country: { type: 'string', example: 'india' },
      role: {
        type: 'string',
        enum: ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper-Batsman', 'Wicketkeeper'],
        example: 'Batsman',
      },
      battingStyle: {
        type: 'string',
        enum: ['Right-handed', 'Left-handed'],
        example: 'Right-handed',
      },
      bowlingStyle: { type: 'string', example: 'Right-arm off-break' },
      age: { type: 'number', example: 37 },
      matches: { type: 'number', example: 243 },
      runs: { type: 'number', example: 9283 },
      wickets: { type: 'number', example: 9 },
      description: { type: 'string', example: 'Known for his elegant strokeplay.' },
      image: { type: 'string', example: '/images/rohit.jpg' },
    },
    required: ['id', 'teamId', 'name', 'role'],
  },

  ErrorResponse: {
    type: 'object',
    properties: {
      error: { type: 'string', example: 'Bad Request' },
      details: { type: 'string', example: 'Additional error information.' },
    },
    required: ['error'],
  },

  SuccessMessage: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
    },
    required: ['success'],
  },
}

export const securitySchemes: Record<string, OpenAPIV3.SecuritySchemeObject> = {
  cookieAuth: {
    type: 'apiKey',
    in: 'cookie',
    name: 'access_token',
    description: 'HttpOnly JWT access token cookie (15-minute lifetime). Set automatically on login/register.',
  },
}
