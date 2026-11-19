import {getDb} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {execute,format} from './analytics.mjs';
const db=await getDb();
try{
 if(db.mode!=='pglite')throw Error('Demo uses local PGlite only. Unset DATABASE_URL.');
 await migrate(db);await seed(db);
 for(const command of ['acquisition','landing','attention'])console.log('\n'+command+'\n'+format(await execute(db,[command,'--site=Fictional Studio'])));
}finally{await db.close();}
