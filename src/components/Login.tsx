import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleLogin = async () => {
        console.log('🔐 Login button clicked');
        
        if (!password.trim()) {
            console.log('❌ Empty password provided');
            setError('Please enter your sudo password');
            return;
        }

        console.log('📝 Password length:', password.length);
        setIsLoading(true);
        setError('');

        try {
            console.log('🚀 Calling login function...');
            const success = await login(password);
            console.log('🔍 Login result:', success);
            
            if (!success) {
                console.log('❌ Login failed');
                setError('Invalid sudo password. Please try again.');
            } else {
                console.log('✅ Login successful');
            }
        } catch (err) {
            console.error('💥 Login exception:', err);
            setError('Login failed. Please check your connection and try again.');
        } finally {
            console.log('🏁 Login process finished');
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Rustinx Authentication
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Enter your sudo password to access the dashboard
                    </p>
                </div>
                <div className="mt-8 space-y-6">
                    <div>
                        <label htmlFor="password" className="sr-only">
                            Sudo Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10"
                            placeholder="Sudo password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                    </div>
                    
                    {error && (
                        <div className="text-red-600 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Authenticating...' : 'Login'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;