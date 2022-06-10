const express = require('express');
const router = express.Router();

const {Client} = require('pg');
const bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'mediumApp',
    password: 'Testing@23',
    port: 5432,
  })
client.connect(err => {
  if (err) {
    console.error('connection error', err.stack)
  } else {
    console.log(' database connected')
  }
})

router.post('/register',(req,res)=>{
    const salt = bcrypt.genSaltSync(6);
    const hash = bcrypt.hashSync(req.body.password, salt);

const text = 'INSERT INTO users(name, email,password) VALUES($1, $2,$3) RETURNING *'
const values = [req.body.name,req.body.email,hash]

client.query(text, values, (err, data) => {
  if (err) {
    console.log(err.stack)
  } else {
    
    res.json(data.rows[0]);
    // { name: 'brianc', email: 'brian.m.carlson@gmail.com' }
  }
})
    
});

router.post('/login',(req,res)=>{

const text = 'select * from users where email=$1';
const values = [req.body.email]

client.query(text, values, (err, data) => {
  if (err) {
    console.log(err.stack)
  } else {
   if(data.rows.length>0){
    let isMatch = bcrypt.compareSync(req.body.password, data.rows[0].password);
    if (!isMatch) {
        return res.json({ msg: 'Invalid Credentials' });
      } else{
        const payload = {
            user: {
              id: data.rows[0].id
            }
          };
          jwt.sign(payload,'jwtSecret',(err, token) => {
              if (err) throw err;
              res.json({ token });
            }
          )
      }
   } else{
    return res.json({ msg: 'Invalid Credentials' });
   }
   
    // { name: 'brianc', email: 'brian.m.carlson@gmail.com' }
  }
})
    
});

router.post('/posts',auth,(req,res)=>{
   
 
    let created_date=new Date();
    const text = 'INSERT INTO posts(name, description,created_by,created_date) VALUES($1, $2,$3,$4) RETURNING id'
const values = [req.body.name,req.body.description,req.user.id,created_date]

client.query(text, values, (err, data) => {
  if (err) {
    console.log(err.stack)
  } 

  insertMultipleTags(req.body.tags,data.rows[0].id,req.user.id,created_date)
  .then(result=>{
   
    res.json(result.message);
  })
  .catch(err=>{
    res.json(err);
  })
});
})

function insertMultipleTags(tags,postId,userId,created_date){
 
 return new Promise((resolve,reject)=>{
    tags.forEach(item=>{
      const text = 'INSERT INTO post_tags(name, post_id,created_by,created_date) VALUES($1, $2,$3,$4)';
      const values = [item,postId,userId,created_date];
      client.query(text,values,(err,result)=>{
        if(err) reject(err);   
      })
    })
   
    resolve({"message":"Successfully Inserted...",});
 })
 }

 router.post('/add/like/:postId',auth,(req,res)=>{
 

   const text='insert into user_like_count(created_by,post_id) values($1,$2)';
   const values=[req.user.id,req.params.postId];
   client.query(text,values,(err,data)=>{
     if(err) throw(err);
     updatePostLikeCount(req.params.postId)
     .then(result=>{
   
      res.json(result.message);
    })
    .catch(err=>{
      res.json(err);
    })
   });
 })
 
  function updatePostLikeCount(postId){

    return new Promise((resolve,reject)=>{
      const text='update posts set likes_count=likes_count+1 where id=$1';
      const values=[postId];
      client.query(text,values,(err,data)=>{
        if(err) reject(err);
       
      });
      resolve({"message":"like added"});
    });
    
  }

  router.post('/add/bookmark/:postId',auth,(req,res)=>{
 
    let created_date=new Date();
    const text='insert into user_bookmark_post(created_by,post_id,created_date) values($1,$2,$3)';
    const values=[req.user.id,req.params.postId,created_date];
    client.query(text,values,(err,data)=>{
      if(err) throw(err);
      res.json('bookmark added');
    });
  })
  
  
  router.post('/add/comment/:postId',auth,(req,res)=>{
 
    let created_date=new Date();
    const text='insert into comments(comment,created_by,post_id,created_date) values($1,$2,$3,$4)';
    const values=[req.body.comment,req.user.id,req.params.postId,created_date];
    client.query(text,values,(err,data)=>{
      if(err) throw(err);
      res.json('comment added');
    });
  })
  
  router.post('/add/reply/:commentId',auth,(req,res)=>{
 
    let created_date=new Date();
    const text='insert into replies(comment_id,reply,created_by,created_date) values($1,$2,$3,$4)';
    const values=[req.params.commentId,req.body.reply,req.user.id,created_date];
    client.query(text,values,(err,data)=>{
      if(err) throw(err);
      res.json('reply added');
    });
  })
  
  // SELECT c.comment, rt.reply
  // from comments c 
  //   left outer join comments r on c.id = r.id  
  //   left outer join replies rt on rt.comment_id = r.id;
  
  router.get('/get/posts/:userId',(req,res)=>{
 
    const shouldAbort = err => {
      if (err) {
        console.error('Error in transaction', err.stack)
        client.query('ROLLBACK', err => {
          if (err) {
            console.error('Error rolling back client', err.stack)
          }
          // release the client back to the pool
          done()
        })
      }
      return !!err
    }
    client.query('BEGIN', err => {
      if (shouldAbort(err)) return
      const queryText = 'select * from posts where created_by=$1'
      client.query(queryText, [req.params.userId], (err, res1) => {
        if (shouldAbort(err)) return
        const insertPhotoText = 'select * from comments where created_by=$1'
        const insertPhotoValues = [req.params.userId]
        client.query(insertPhotoText, insertPhotoValues, (err, res2) => {
          if (shouldAbort(err)) return
          const likeQuery = 'select * from user_like_count where created_by=$1'
        const likeValue = [req.params.userId]
        client.query(likeQuery, likeValue, (err, res3) => {
          if (shouldAbort(err)) return
          client.query('COMMIT', err => {
            if (err) {
              console.error('Error committing transaction', err.stack)
            }
          //  done()
          res.json({'posts':res1.rows,'comments':res2.rows,'likes':res3.rows});
          })
        })
        })
      })
    })

  })

module.exports = router;
