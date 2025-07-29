require('dotenv').config();

const config = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'llm_chatbot_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || (() => {
        throw new Error('DB_PASSWORD environment variable is required');
      })(),
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },

  test: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME_TEST || 'llm_chatbot_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || (() => {
        throw new Error('DB_PASSWORD environment variable is required');
      })(),
    },
    pool: {
      min: 1,
      max: 5
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'llm_chatbot',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || (() => {
        throw new Error('DB_PASSWORD environment variable is required');
      })(),
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      } : false,
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  }
};

module.exports = config;