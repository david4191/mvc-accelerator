const WebSocket = require('ws');
const vscode = require('vscode');

class WebSocketService {
    constructor(context, apiService, authService) {
        this.context = context;
        this.apiService = apiService;
        this.authService = authService;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
    }

    /**
     * Connect to WebSocket
     */
    async connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        const isAuthenticated = await this.authService.isAuthenticated();
        if (!isAuthenticated) {
            return;
        }

        const apiUrl = vscode.workspace.getConfiguration('mvcAccelerator').get('apiUrl');
        const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws';
        const token = await this.context.globalState.get('authToken');

        try {
            this.ws = new WebSocket(wsUrl, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            this.ws.on('open', () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.showNotification('Connected to real-time updates');
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

            this.ws.on('close', () => {
                console.log('WebSocket disconnected');
                this.reconnect();
            });

        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.reconnect();
        }
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    /**
     * Reconnect WebSocket
     */
    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        this.reconnectTimeout = setTimeout(() => {
            console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
            this.connect();
        }, delay);
    }

    /**
     * Handle incoming message
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'scan_complete':
                    this.handleScanComplete(message.data);
                    break;
                    
                case 'fix_complete':
                    this.handleFixComplete(message.data);
                    break;
                    
                case 'generation_complete':
                    this.handleGenerationComplete(message.data);
                    break;
                    
                case 'subscription_updated':
                    this.handleSubscriptionUpdate(message.data);
                    break;
                    
                case 'notification':
                    this.showNotification(message.data.message, message.data.type);
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
            
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    /**
     * Handle scan complete
     */
    handleScanComplete(data) {
        vscode.window.showInformationMessage(
            `Scan complete! Found ${data.issues} issues.`,
            'View Results'
        ).then(selection => {
            if (selection === 'View Results') {
                vscode.commands.executeCommand('mvc-accelerator.scan');
            }
        });
    }

    /**
     * Handle fix complete
     */
    handleFixComplete(data) {
        vscode.window.showInformationMessage(
            `Fixed ${data.fixed} issues!`,
            'View Changes'
        ).then(selection => {
            if (selection === 'View Changes') {
                // Show changes
            }
        });
    }

    /**
     * Handle generation complete
     */
    handleGenerationComplete(data) {
        vscode.window.showInformationMessage(
            `Generation complete! Created ${data.files} files.`,
            'Open Files'
        ).then(selection => {
            if (selection === 'Open Files') {
                vscode.commands.executeCommand('mvc-accelerator.generate');
            }
        });
    }

    /**
     * Handle subscription update
     */
    handleSubscriptionUpdate(data) {
        vscode.window.showInformationMessage(
            `Subscription updated: ${data.status}`,
            'View Details'
        ).then(selection => {
            if (selection === 'View Details') {
                vscode.commands.executeCommand('mvc-accelerator.subscribe');
            }
        });
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        switch (type) {
            case 'success':
                vscode.window.showInformationMessage(message);
                break;
            case 'warning':
                vscode.window.showWarningMessage(message);
                break;
            case 'error':
                vscode.window.showErrorMessage(message);
                break;
            default:
                vscode.window.showInformationMessage(message);
        }
    }

    /**
     * Send message
     */
    send(type, data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, data }));
        }
    }
}

module.exports = { WebSocketService };