import React from 'react';
import { useState, useEffect } from 'react';
import './App.css';
import Logo from './logo.png';
import { listen } from '@tauri-apps/api/event';


function App() {
	const [event, setEvent] = useState("");

	useEffect(() => {
		// Function to handle the event
		const handleMyEvent = (event: { payload: any; }) => {
		  console.log('Data from Rust:', event.payload);
		  setEvent(event.payload);
		};
	
		// Start listening for the event
		const unlisten = listen('my_event', handleMyEvent);
	
		// Cleanup listener on component unmount
		return () => {
		  unlisten.then((unlistenFn) => unlistenFn());
		};
	  }, []);

	return (
		<div className='App'>
			<header className='App-header'>
				<img src={Logo} className='App-logo' alt='logo' />
				<p>Hello Parcel + React!</p>
				<p>
					<button type='button' onClick={() => setEvent((count) => count + 1)}>
						count is: {event}
					</button>
				</p>
				<p>
					Edit <code>App.tsx</code> and save to test HMR updates.
				</p>
				<p>
					<a
						className='App-link'
						href='https://reactjs.org'
						target='_blank'
						rel='noopener noreferrer'>
						Learn React
					</a>
					{' | '}
					<a
						className='App-link'
						href='https://parceljs.org/'
						target='_blank'
						rel='noopener noreferrer'>
						Parcel Docs
					</a>
				</p>
			</header>
		</div>
	);
}

export default App;
