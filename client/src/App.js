import React from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import SearchBooks from './pages/SearchBooks';
import SavedBooks from './pages/SavedBooks';
import Navbar from './components/Navbar';
import HUconsumption from './pages/HUConsumption';

function App() {
  return (
    <Router>
      <>
        <Navbar /> 
        <Switch>
          <Route exact path='/' render={() => <h1 className='display-2'>Click on "Features"</h1>}/>
{/*           <Route exact path='/' component={SearchBooks} /> */}
          <Route exact path='/HUconsumption' component={HUconsumption} />
          <Route exact path='/saved' component={SavedBooks} />
          <Route render={() => <h1 className='display-2'>Wrong page!</h1>} />
        </Switch>
      </>
    </Router>
  );
}

export default App;
