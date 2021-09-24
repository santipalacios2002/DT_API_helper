import React, { useState, useEffect } from 'react';
import { Jumbotron, Container, Col, Form, Button, Card, CardColumns, Table } from 'react-bootstrap';
import Auth from '../utils/auth';
import { saveBook, searchGoogleBooks, getHostUnitConsumption } from '../utils/API';
import { saveBookIds, getSavedBookIds } from '../utils/localStorage';
import Swal from 'sweetalert2'


let totalHUsConsumed = 0;
let HUdata = [];
const SearchBooks = () => {
  // create state for holding returned google api data
  const [searchedBooks, setSearchedBooks] = useState([]);
  // create state for holding our search field data
  const [searchInput, setSearchInput] = useState('');
  // create state to hold saved bookId values
  const [savedBookIds, setSavedBookIds] = useState(getSavedBookIds());





  // create state for holding our tenantId field data  **SANTIAGO
  const [tenantId, setTenantId] = useState('');
  // create state for holding our API Token field data  **SANTIAGO
  const [apiToken, setapiToken] = useState('');
  // create state for holding our API Token field data  **SANTIAGO
  const [total, setTotal] = useState(false);
  // create state for holding our API Token field data  **SANTIAGO
  const [Hosts, setHosts] = useState([]);
  // console.log('Hosts:', Hosts)
  const [isLoading, setIsLoading] = useState(false);
  // console.log('isLoading:', isLoading)




  // set up useEffect hook to save `savedBookIds` list to localStorage on component unmount
  // learn more here: https://reactjs.org/docs/hooks-effect.html#effects-with-cleanup
  useEffect(() => {
    return () => saveBookIds(savedBookIds);
  });

  // create method to search for books and set state on form submit
  const handleFormSubmit = async (event) => {
    event.preventDefault();

    if (!searchInput) {
      return false;
    }

    try {
      const response = await searchGoogleBooks(searchInput);

      if (!response.ok) {
        throw new Error('something went wrong!');
      }

      const { items } = await response.json();

      const bookData = items.map((book) => ({
        bookId: book.id,
        authors: book.volumeInfo.authors || ['No author to display'],
        title: book.volumeInfo.title,
        description: book.volumeInfo.description,
        image: book.volumeInfo.imageLinks?.thumbnail || '',
      }));

      setSearchedBooks(bookData);
      setSearchInput('');
    } catch (err) {
      console.error(err);
    }
  };


    // create method to get the information from the tenant
  const handleDynatraceFormSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    Swal.fire({
      title: 'Loading',
      // html: 'I will close in <b></b> milliseconds.',
      timerProgressBar: true,
      didOpen: () => {
        Swal.showLoading()
      }
    })

    // console.log('dynatrace handled: ', {tenantId, apiToken})
    if (!(tenantId || apiToken)) {
      console.log('something is missing')
      return false;
    }
    localStorage.setItem('tenantUrl', tenantId)
    localStorage.setItem('apiToken', apiToken)

    try {
      const response = await getHostUnitConsumption(tenantId, apiToken);

      if (!response.ok) {
        // console.log('response!!!!!!!:', response)
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Something went wrong!',
          footer: `<strong>${response.status} - (${response.statusText}). Please verify tenant and token</strong>`
        })
        setIsLoading(false)
        throw new Error('something went wrong!');
      }
      const last10min = Date.now()-600000;
      console.log('last10min:', last10min)
      const items = await response.json();
      // console.log('items:', items)
      HUdata = items.map((host) => {
        if (host.lastSeenTimestamp > last10min ) {
            return ({
              consumedHUs: host.consumedHostUnits,
              displayName: host.displayName,
              entityId: host.entityId
            }
            )
          } else return
      }).filter(o => o !== undefined)

      // console.log(HUdata)
      totalHUsConsumed = HUdata.reduce((total, value) => total + value.consumedHUs, 0)
      setTotal(true)
      setHosts(HUdata)
      localStorage.setItem('totalHUs', totalHUsConsumed)
      setIsLoading(false)
      Swal.close()
    } catch (err) {
      console.error(err);
    }
  };

  // create function to handle saving a book to our database
  const handleSaveBook = async (bookId) => {
    // find the book in `searchedBooks` state by the matching id
    const bookToSave = searchedBooks.find((book) => book.bookId === bookId);

    // get token
    const token = Auth.loggedIn() ? Auth.getToken() : null;

    if (!token) {
      return false;
    }

    try {
      const response = await saveBook(bookToSave, token);

      if (!response.ok) {
        throw new Error('something went wrong!');
      }

      // if book successfully saves to user's account, save book id to state
      setSavedBookIds([...savedBookIds, bookToSave.bookId]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Jumbotron fluid className='text-light' style={{backgroundColor: "#191919"}}>
        <Container>
          <h1>Get your Host unit Consumption!</h1>
{/*           <Form onSubmit={handleFormSubmit}>
            <Form.Row>
              <Col xs={12} md={8}>
                <Form.Control
                  name='searchInput'
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  type='text'
                  size='lg'
                  placeholder='Search for a book'
                />
              </Col>
              <Col xs={12} md={4}>
                <Button type='submit' variant='success' size='lg'>
                  Submit Search
                </Button>
              </Col>
            </Form.Row>
  </Form> */}
          {/* copy for the form for tenant and token SANTIAGO */}
          {/* =============================================== */}
          <Form onSubmit={handleDynatraceFormSubmit}>
          <Form.Row>
            <Col xs={12} md={8} className='mb-3'>
              <Form.Control
                name='tenantId'
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                type='text'
                size='lg'
                placeholder='https://TENANT_ID.live.dynatrace.com/'
              />
            </Col>
          </Form.Row>
          <Form.Row>
            <Col xs={12} md={8}>
              <Form.Control
                name='apiToken'
                value={apiToken}
                onChange={(e) => setapiToken(e.target.value)}
                type='password'
                size='lg'
                placeholder='API Token'
              />
            </Col>
            <Col xs={12} md={4}>
              <Button type='submit' variant='success' size='lg' style={{backgroundColor: '#4fd5e0', border: 'none'}}>
                Submit Search
              </Button>
            </Col>
          </Form.Row>
      </Form>
        </Container>
      </Jumbotron>
      <Container>
        <h2>
       {total
        ? `Your tenant is consuming a total of ${totalHUsConsumed} with ${Hosts.length} Hosts`
        : 'Enter your tenant and API token'} 
        </h2>
        {isLoading ? 'Loading...' 
        : 
        <Table striped bordered hover hidden={isLoading || Hosts.length === 0}>
        <thead>
          <tr>
            <th>#</th>
            <th>Host Name</th>
            <th>Host Entity ID</th>
            <th>Consumed HUs</th>
          </tr>
        </thead>
        <tbody>
        {Hosts.map((host, index) => {
          return (
          <tr key={host.entityId}>
            <td>{index+1}</td>
            <td>{host.displayName}</td>
            <td>{host.entityId}</td>
            <td>{host.consumedHUs}</td>
          </tr>)
        })}
        </tbody>
        </Table>}
        <CardColumns>
          {searchedBooks.map((book) => {
            return (
              <Card key={book.bookId} border='dark'>
                {book.image ? (
                  <Card.Img src={book.image} alt={`The cover for ${book.title}`} variant='top' />
                ) : null}
                <Card.Body>
                  <Card.Title>{book.title}</Card.Title>
                  <p className='small'>Authors: {book.authors}</p>
                  <Card.Text>{book.description}</Card.Text>
                  {Auth.loggedIn() && (
                    <Button
                      disabled={savedBookIds?.some((savedBookId) => savedBookId === book.bookId)}
                      className='btn-block btn-info'
                      onClick={() => handleSaveBook(book.bookId)}>
                      {savedBookIds?.some((savedBookId) => savedBookId === book.bookId)
                        ? 'This book has already been saved!'
                        : 'Save this Book!'}
                    </Button>
                  )}
                </Card.Body>
              </Card>
            );
          })}
        </CardColumns>
      </Container>
    </>
  );
};

export default SearchBooks;
