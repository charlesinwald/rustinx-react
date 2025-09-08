import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Meteors } from './ui/meteors';
import { Eye, EyeOff } from 'lucide-react';

const Login: React.FC = () => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            <div className="max-w-md w-full space-y-8 relative z-10">
                <div>
                    <h2 className="mt-6 text-center text-6xl font-extrabold text-foreground">
                        Sign In
                    </h2>
                    <p className="mt-2 text-center text-lg text-light-text">
                        Enter your sudo password to access the dashboard
                    </p>
                </div>
                <div className="mt-8 space-y-6">
                    <div className="relative">
                        <label htmlFor="password" className="sr-only">
                            Sudo Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            className="appearance-none rounded-md relative block w-full px-3 py-2 pr-10 border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input disabled:opacity-50"
                            placeholder="Sudo password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
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
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </div>
                </div>
            </div>
            <Meteors number={20} />
        </div>
    );
};

export default Login;