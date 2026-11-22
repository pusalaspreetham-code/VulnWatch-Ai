const express=require('express');
const app=express();
const pool=require('./db');

const port=process.env.PORT
app.use(express.json());

app.get('/',(req,res)=>{
    console.log(req.body);
    res.json({message:"VUlnWatch-Ai  backend is running "})
});

app.get('/health',async (req,res)=>{
    console.log(req.body);
    try{
        const result=await pool.query("SELECT NOW()");
        res.json({  
            message:"Healthy",
            database:"Connected",
            time:result.rows[0].now
        });
    }
    catch(err){
        console.error(err);
        res.status(500).json({
            message:"Unhealthy",
            database:"Disconnected",
        })
    }
})

app.listen(port,()=>{
    console.log(`Server is running on port ${port}`);
});