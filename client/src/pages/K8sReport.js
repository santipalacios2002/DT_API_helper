import React, { useState, useEffect } from 'react';
import {
  Jumbotron,
  Container,
  Col,
  Form,
  Button,
  Card,
  CardColumns,
  Table,
} from 'react-bootstrap';
import Auth from '../utils/auth';
import {
  saveBook,
  searchGoogleBooks,
  getHostUnitConsumption,
} from '../utils/API';
import { saveBookIds, getSavedBookIds } from '../utils/localStorage';
import Swal from 'sweetalert2';
import 'react-bootstrap-table-next/dist/react-bootstrap-table2.min.css';
import BootstrapTable from 'react-bootstrap-table-next';
import ToolkitProvider, {
  Search,
  CSVExport,
} from 'react-bootstrap-table2-toolkit';
const percentile = require("percentile"); // calculates percentiles

// const products = [ {id: 1, name: 'hello', entityId: '1234', hus: 2, mon_mode: 'full'} ];
const { SearchBar, ClearSearchButton } = Search;


const columns = [
  {
    dataField: 'id',
    text: '#',
    sort: true,
  },
  {
    dataField: 'name',
    text: 'Host Name',
    sort: true,
  },
  {
    dataField: 'entityId',
    text: 'Host Entity ID',
  },
  {
    dataField: 'hus',
    text: 'Consumed HUs',
    sort: true,
  },
  {
    dataField: 'mon_mode',
    text: 'Monitoring Mode',
    sort: true,
  },
];
const defaultSorted = [
  {
    dataField: 'id',
    order: 'asc',
  },
];

let k8shosts = []; // array to store list of k8s hosts
let apiURI = ''; // used to stage api endpoints before querying
let totalMem = 0, totalHU = 0, totalOldHU = 0; // to calculate total memory and HUs
let removeHosts = []; // list of k8s hosts with no memory metrics for the period
let detailData = []; // fow raw data report when detailedReport is enabled
let nextKey = null; // to track next page key so we can handle pagination
const huFactor = 16; // number of GB per HU
const percentileCutoff = 99; // percentile to calculate HU

let totalHUsConsumed = 0;
let HUdata = [];

const tags = process.env.HOST_TAGS == null ? '' : `&tag=${process.env.HOST_TAGS.split(',').join('&tag=')}`; // if tags are set, store as query string
const mzs = process.env.MZ == null ? '' : `&managementZone=${process.env.MZ}`; // if mz is set, store as query string
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
  // create state for management zone  **SANTIAGO
  const [mgmtZone, setmgmtZone] = useState('');
  // create state for tags  **SANTIAGO
  const [tag, setTag] = useState('');
  // create state for getting the total host units  **SANTIAGO
  const [total, setTotal] = useState(false);
  // create state for the hosts  **SANTIAGO
  const [Hosts, setHosts] = useState([]);
  // console.log('Hosts:', Hosts)
  // create state for the loading flag  **SANTIAGO
  const [isLoading, setIsLoading] = useState(false);
  // console.log('isLoading:', isLoading)
  // creates state for sorting fields
  const [sortedField, setSortedField] = useState(null);

  // set up useEffect hook to save `savedBookIds` list to localStorage on component unmount
  // learn more here: https://reactjs.org/docs/hooks-effect.html#effects-with-cleanup
  useEffect(() => {
    return () => saveBookIds(savedBookIds);
  });

  // create method to search for books and set state on form submit


  // create method to get the information from the tenant
  const handleDynatraceFormSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    Swal.fire({
      title: 'Loading',
      // html: 'I will close in <b></b> milliseconds.',
      timerProgressBar: true,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // console.log('dynatrace handled: ', {tenantId, apiToken})
    if (!(tenantId || apiToken)) {
      console.log('something is missing');
      return false;
    }
    localStorage.setItem('tenantUrl', tenantId);
    localStorage.setItem('apiToken', apiToken);

    try {
      const response = await getHostUnitConsumption(tenantId, apiToken);

      if (!response.ok) {
        // console.log('response!!!!!!!:', response)
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Something went wrong!',
          footer: `<strong>${response.status} - (${response.statusText}). Please verify tenant and token</strong>`,
        });
        setIsLoading(false);
        throw new Error('something went wrong!');
      }
      const last10min = Date.now() - 600000;
      console.log('last10min:', last10min);
      const items = await response.json();
      // console.log('items:', items)
      HUdata = items
        .map((host) => {
          if (host.lastSeenTimestamp > last10min) {
            return {
              displayName: host.displayName,
              entityId: host.entityId,
              consumedHUs: host.consumedHostUnits,
              monitoringMode: host.monitoringMode,
            };
          } else return;
        })
        .filter((o) => o !== undefined);

      // console.log(HUdata)
      totalHUsConsumed = HUdata.reduce(
        (total, value) => total + value.consumedHUs,
        0
      );
      setTotal(true);
      setHosts(HUdata);
      const hosts2 = HUdata.map((host, index) => {
        return {
          id: index + 1,
          name: host.displayName,
          entityId: host.entityId,
          hus: host.consumedHUs,
          mon_mode: host.monitoringMode,
        };
      });
      setHosts(hosts2);
      console.log('hosts2:', hosts2);
      localStorage.setItem('totalHUs', totalHUsConsumed);
      setIsLoading(false);
      Swal.close();
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
      <Jumbotron
        fluid
        className='text-light'
        style={{ backgroundColor: '#191919' }}>
        <Container>
          <h1>Kubernetes Consumption Report</h1>
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
                <Button
                  type='submit'
                  variant='success'
                  size='lg'
                  style={{ backgroundColor: '#4fd5e0', border: 'none' }}>
                  Submit Search
                </Button>
              </Col>
            </Form.Row>
          </Form>
        </Container>
      </Jumbotron>
      <Container fluid>
        <h2>
          {total
            ? `Your tenant is consuming a total of ${totalHUsConsumed} with ${Hosts.length} Hosts`
            : <div className="justify-content-md-center" >Enter your tenant and API token</div>}
        </h2>
        {/*         {isLoading ? (
          'Loading...'
        ) : (
          <Table
            striped
            bordered
            hover
            variant="dark"
            hidden={isLoading || Hosts.length === 0}>
            <thead>
              <tr>
                <th>
                  <button type='button' onClick={() => setSortedField('index')}>
                    #
                  </button>
                </th>
                <th>
                  <button type='button' onClick={() => setSortedField('index')}>
                    Host Name
                  </button>
                </th>
                <th>
                <button type='button' onClick={() => setSortedField('index')}>
                Host Entity ID
              </button>
              </th>
                <th>
                <button type='button' onClick={() => setSortedField('index')}>
                Consumed HUs
              </button>
                </th>
                <th>
                <button type='button' onClick={() => setSortedField('index')}>
                Monitoring Mode
              </button> 
                </th>
              </tr>
            </thead>
            <tbody>
              {Hosts.map((host, index) => {
                return (
                  <tr key={host.entityId}>
                  <td>{index + 1}</td>
                  <td>{host.displayName}</td>
                  <td>{host.entityId}</td>
                  <td>{host.consumedHUs}</td>
                  <td>{host.monitoringMode}</td>
                  </tr>
                  );
                })}
                </tbody>
                </Table>
              )} */}
        <ToolkitProvider
          bootstrap4
          keyField='entityId'
          data={Hosts}
          columns={columns}
          defaultSorted={defaultSorted}
          striped
          hover
          condensed
          search>
          {(props) => (
            <div>
              <h3>Search or filter by any data:</h3>
              <SearchBar {...props.searchProps} />
              <ClearSearchButton {...props.searchProps} />
              <hr />
              <BootstrapTable {...props.baseProps} />
            </div>
          )}
        </ToolkitProvider>
        {/* <CardColumns>
          {searchedBooks.map((book) => {
            return (
              <Card key={book.bookId} border='dark'>
                {book.image ? (
                  <Card.Img
                    src={book.image}
                    alt={`The cover for ${book.title}`}
                    variant='top'
                  />
                ) : null}
                <Card.Body>
                  <Card.Title>{book.title}</Card.Title>
                  <p className='small'>Authors: {book.authors}</p>
                  <Card.Text>{book.description}</Card.Text>
                  {Auth.loggedIn() && (
                    <Button
                      disabled={savedBookIds?.some(
                        (savedBookId) => savedBookId === book.bookId
                      )}
                      className='btn-block btn-info'
                      onClick={() => handleSaveBook(book.bookId)}>
                      {savedBookIds?.some(
                        (savedBookId) => savedBookId === book.bookId
                      )
                        ? 'This book has already been saved!'
                        : 'Save this Book!'}
                    </Button>
                  )}
                </Card.Body>
              </Card>
            );
          })}
        </CardColumns> */}
      </Container>
    </>
  );
};

export default SearchBooks;
