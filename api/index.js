const express = require('express');
const axios = require("axios");
const cors = require('cors');

const app = express();
const port = 5123;
const esUrl = "http://127.0.0.1:9200";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());


const responseBody = (status, code, message, data = null) => {
   return { status, code, message, data }
}

app.get('/:index/autocomplete', async (req, res) => {
   try {
      const { q } = req.query;

      const payload = {
         _source: [],
         size: 0,
         min_score: 0.5,
         query: {
            bool: {
               must: [
                  {
                     match_phrase_prefix: {
                        title: {
                           query: q
                        }
                     }
                  }
               ],
               filter: [],
               should: [],
               must_not: []
            }
         },
         aggs: {
            auto_complete: {
               terms: {
                  field: 'title.keyword',
                  order: {
                     _count: 'desc'
                  },
                  size: 25
               }
            }
         }
      }

      const products = await axios.post(`${esUrl}/${req.params.index}/_search`, payload);
      res.json(responseBody(
         "success",
         200,
         'Obtained',
         products.data.aggregations.auto_complete.buckets
      ));
   } catch (error) {
      res.status(500);
      res.send(error);
   }
})

app.get('/:index/search', async (req, res) => {
   try {
      const { q } = req.query;

      const payload = {
         min_score: 0.95,
         query: {
            match: {
               title: q
            }
         }
      }

      const products = await axios.post(`${esUrl}/${req.params.index}/_search`, payload);

      const response = {
         total: products.data.hits.total.value,
         currentPage: 1,
         perPage: 10,
         totalPage: 1,
         records: products.data.hits.hits.map(r => { return { _id: r._id, ...r._source } })
      }

      res.json(responseBody(
         "success",
         200,
         'Obtained',
         response
      ));
   } catch (error) {
      res.status(500);
      res.send(error);
   }
})


app.get('/:index', async (req, res) => {

   try {
      const { page, q, c } = req.query;

      let payload = {
         from: (page !== undefined && page > 1) ? (page * 10) - 10 : 0,
         size: 10
      }

      if (q !== undefined && q !== "") {
         payload.min_score = 0.95;
         payload.query = {
            match: {
               title: q
            }
         };
      }

      if (c !== undefined && c !== "") {
         payload.min_score = 0.95;
         payload.query = {
            match: {
               category: c
            }
         };
      }

      payload.aggs = {
         categories: {
            terms: { field: "category.keyword" }
         }
      }

      const product = await axios.post(`${esUrl}/${req.params.index}/_search`, payload);
      const response = {
         total: product.data.hits.total.value,
         currentPage: (page !== undefined && page > 1) ? parseInt(page) : 1,
         perPage: 10,
         totalPage: Math.ceil(product.data.hits.total.value / 10),
         records: product.data.hits.hits.map(r => { return { _id: r._id, ...r._source } }),
         aggregations: {
            categories: product.data.aggregations.categories.buckets,
         }
      }

      res.json(responseBody(
         "success",
         product.status,
         product.statusText,
         response
      ));
   } catch (error) {
      res.status(500);
      res.send(error);
   }
})

app.get('/:index/:id', async (req, res) => {

   try {
      const product = await axios.get(`${esUrl}/${req.params.index}/_doc/${req.params.id}`)
      res.json(responseBody(
         "success",
         product.status,
         product.statusText,
         { _id: product.data._id, ...product.data._source }
      ));
   } catch (error) {
      res.status(500);
      res.send(error);
   }
})

app.post('/', async (req, res) => {
   try {
      const { index, doc } = req.body;
      const product = await axios.post(`${esUrl}/${index}/_doc`, doc);

      res.json(responseBody(
         "success",
         product.status,
         product.statusText,
         { _id: product.data._id, ...doc }
      ));
   } catch (error) {
      res.status(500);
      res.send(error);
   }
})

app.put('/:index/:id', async (req, res) => {
   try {
      const { index, id } = req.params;
      const product = await axios.post(`${esUrl}/${index}/_doc/${id}`, req.body);
      res.json(responseBody(
         "success",
         product.status,
         product.statusText,
         { _id: product.data._id, ...req.body }
      ));
   } catch (error) {
      res.status(500);
      res.send(error);
   }
})

app.delete('/:index/:id', async (req, res) => {
   try {
      const { index, id } = req.params;
      await axios.delete(`${esUrl}/${index}/_doc/${id}`);
      res.json(responseBody(
         "success",
         200,
         'Deleted',
         null
      ));
   } catch (error) {
      res.status(500);
      res.send(error);
   }

})

app.use((req, res) => {
   res.status(400);
   res.send({ error: "Not Found" })
})

app.listen(port, () =>
   console.log(`Server up and listen port ${port}`)
);