require("dotenv").config({path:"/app/backend/.env"});
const {Client}=require("pg");
(async()=>{const c=new Client({host:process.env.HOST,port:Number(process.env.DB_PORT),user:process.env.USER_NAME,password:process.env.PASSWORD,database:process.env.DB_NAME,ssl:{rejectUnauthorized:false}});await c.connect();
const sql=process.argv[2];const r=await c.query(sql);console.log(JSON.stringify(r.rows,null,1));await c.end();})().catch(e=>{console.error(e.message);process.exit(1)})
