'use strict';
const express = require('express');
const pg = require('pg')
const cors = require('cors');
const superAgent = require('superagent');
const override = require('method-override');
const app = express();

require('dotenv').config();


app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static('./public'));
app.use(override('_method'));
app.set('view engine', 'ejs');

const PORT = process.env.PORT;

let client = new pg.Client(process.env.DATABASE_URL);
// const client = new pg.Client({ connectionString: process.env.DATABASE_URL,   ssl: { rejectUnauthorized: false } });

//======================ROUTES========================

app.get('/', handleHome);
app.get('/searches/new', handleNew);
app.post('/searches', handleSearches);
app.post('/books', handleBooks);
app.get('/books/:id', handleOneBook);
app.put('/books/:id', handleUpdate);
app.delete('/books/:id', handleDelete);
app.get('*', handleError);

const googleAPI = 'https://www.googleapis.com/books/v1/volumes';

//=====================Handle Home=====================

function handleHome(req, res) {
    client.query('SELECT * FROM books').then(data => {

        res.render('pages/index', { favBooks: data.rows })
    }).catch(error => {
        res.status(500).render('pages/error');
    });
}

//==================Handle New search=====================

function handleNew(req, res) {
    res.render('pages/searches/new');
}

//===================Handle searches=========================
function handleSearches(req, res) {
    let searchQuery = req.body.searchQuery;
    let searchWith = req.body.searchBy;
    let que = "+in" + searchWith + ":" + searchQuery;

    let query = {
        q: que
    };

    superAgent.get(googleAPI).query(query).then(data => {
        let booksArray = [];
        data.body.items.map((value) => {
            // console.log(value);

            let booksObject = new Book(value.volumeInfo);

            booksArray.push(booksObject);
        });
        // console.log(booksArray);
        res.render('pages/searches/show', { arrayOfItems: booksArray });

    }).catch(error => {
        console.log(error);
        res.status(500).send('there is an error ' + error);
    });
}

//===================Handle Books=====================

function handleBooks(req, res) {
    // console.log(req.body);
    let reqBody = req.body;
    let insertQuery = 'INSERT INTO books(author,title,isbn,image_url,description) VALUES ($1,$2,$3,$4,$5) RETURNING *;';

    let safeValue = [reqBody.authors, reqBody.title, reqBody.isbn, reqBody.image, reqBody.description];

    client.query(insertQuery, safeValue).then((data) => {
        let id = data.rows[0].id;
        res.redirect(`/books/${id}`);
    }).catch(error => {
        console.log(error)
        res.status(500).render('pages/error');
    });
}

//=====================Handle One Book===================

function handleOneBook(req, res) {
    // console.log('gfkufh',req.params);
    let id = req.params.id;
    let selectQuery = 'SELECT * FROM books WHERE id = $1';
    let safeValues = [id];
    // console.log(id);

    client.query(selectQuery, safeValues).then(data => {
        // console.log(data);
        res.render('pages/details', { oneBook: data.rows[0] });
    }).catch(error => {
        res.status(500).render('pages/error');
    });
}

//=====================Handle update====================

function handleUpdate(req,res) {
    let id = req.params.id;
    let reqBody = req.body
    let updateQuery = 'UPDATE books set author = $1, title = $2, isbn = $3, image_url = $4, description = $5 WHERE id = $6 ;';
    let safeValues = [reqBody.authors, reqBody.title, reqBody.isbn, reqBody.image, reqBody.description,id];
    client.query(updateQuery,safeValues).then(()=>{
        res.redirect(`/books/${id}`)
    }) .catch (error=>{
        console.log('error occurred while updating details '+ error);
    })
}

//=====================Handle Delete===================

function handleDelete(req,res) {
    let id = req.params.id;
    let deleteQuery = 'DELETE FROM books WHERE id=$1;'
    let safeValue = [id];
    client.query(deleteQuery,safeValue).then(()=>{
        res.redirect('/');
    }).catch(error=>{
        console.log('An error occurred while deleting the book '+ error);
    })
}

//====================Book Constructor=======================

function Book(data) {
    if (data.imageLinks) {
        this.thumbnail = data.imageLinks.thumbnail;
    } else {
        this.thumbnail = 'https://www.freeiconspng.com/uploads/book-icon--icon-search-engine-6.png';
    }
    this.title = data.title || 'there is no title';
    if (data.industryIdentifiers) {
        this.type = data.industryIdentifiers[0].identifier;
    } else {
        this.type = 'ISBN was not found';
    }
    // console.log(this.type);
    this.authors = data.authors || 'No authors are founded';
    if (data.description) {
        this.description = data.description;
    } else {
        this.description = 'No description was found';
    }
}

//======================Handle Errors=======================

function handleError(req, res) {
    res.render('pages/error');
}

//============Connect to DB & Listener=======================

client.connect().then(() => {
    app.listen(PORT, () => {
        console.log('listening on port ', PORT);
    });
}).catch((error) => {
    res.status(500).render('pages/error');
});