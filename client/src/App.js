import React from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import SavedBooks from './pages/SavedBooks';
import Navbar from './components/Navbar';
import HUconsumption from './pages/HUConsumption';
import K8sReport from './pages/K8sReport';
import SyntheticMonitors from './pages/SyntheticMassEdit';


function App() {
  return (
    <Router>
      <>
        <Navbar /> 
        <Switch>
          <Route exact path='/' render={() => <h1 className='display-2'>Click on "Features"</h1>}/>
          <Route exact path='/HUconsumption' component={HUconsumption} />
          <Route exact path='/K8sreport' component={K8sReport} />
          <Route exact path='/SyntheticMonitor' component={SyntheticMonitors} />
          <Route exact path='/saved' component={SavedBooks} />
          <Route render={() => <h1 className='display-2'>Wrong page!</h1>} />
        </Switch>
      </>
    </Router>
  );
}

export default App;
