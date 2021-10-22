import React from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import SavedBooks from './pages/SavedBooks';
import Navbar from './components/Navbar';
import HUconsumption from './pages/HUConsumption';
import K8sReport from './pages/K8sReport';
import SyntheticMonitors from './pages/SyntheticMassEdit';
import MainPage from './pages/MainPage';
import Lpl from './components/Lpl';
import Example from './components/Sidebar';


function App() {

  return (
    <Router>
      <>
        <div id='outer-container'>
          <Example 
          />
          <main id='page-wrap'>
            <Switch>
              <Route exact path='/' component={MainPage}
              />
              <Route exact path='/HUconsumption' component={HUconsumption} />
              <Route exact path='/K8sreport' component={K8sReport} />
              <Route
                exact
                path='/SyntheticMonitor'
                component={SyntheticMonitors}
              />
              <Route exact path='/LPL' component={Lpl} />
              <Route exact path='/saved' component={SavedBooks} />
              <Route
                render={() => <h1 className='display-2'>Wrong page!</h1>}
              />
            </Switch>

          </main>
        </div>
      </>
    </Router>
  );
}

export default App;
