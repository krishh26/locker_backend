// import { createClient } from '@supabase/supabase-js';
// import { DataSource } from 'typeorm';

// const supabaseUrl = process.env.SUPABASE_URL
// const supabaseKey = process.env.SUPABASE_KEY

// const supabase = createClient(supabaseUrl, supabaseKey);

// export const AppDataSource = new DataSource({
//     type: 'postgres',
//     host: process.env.POSTGRES_HOST,
//     port: parseInt(process.env.POSTGRES_PORT as string),
//     username: process.env.POSTGRES_USERNAME,
//     password: process.env.POSTGRES_PASSWORD,
//     database: process.env.POSTGRES_DATABASE,
//     synchronize: true,
//     logging: false,
//     entities: [__dirname + '/../**/*.entity.{js,ts}'],
//     migrations: [],
//     subscribers: [],
//     extra: {
//         supabase,
//     },
// });

import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT as string, 10),
    username: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    synchronize: true,
    // dropSchema: true,
    logging: false,
    entities: [__dirname + '/../**/*.entity.ts'],
    migrations: [],
    subscribers: [],
    extra: {
        ssl: {
            rejectUnauthorized: false,
        },
    },
});