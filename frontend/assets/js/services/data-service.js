// Data Service - handles general API communications
class DataService {
  constructor() {
    this.baseURL = window.API_BASE_URL;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;
  }

  // Generic API request method
  async makeRequest(endpoint, options = {}) {
    const { method = 'GET', data = null, headers = {} } = options;
    
    try {
      const token = await authService.getAuthToken();
      
      const requestOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (token) {
        requestOptions.headers['Authorization'] = `Bearer ${token}`;
      }

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        requestOptions.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, requestOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint, headers = {}) {
    return this.makeRequest(endpoint, { method: 'GET', headers });
  }

  // POST request
  async post(endpoint, data, headers = {}) {
    return this.makeRequest(endpoint, { method: 'POST', data, headers });
  }

  // PUT request
  async put(endpoint, data, headers = {}) {
    return this.makeRequest(endpoint, { method: 'PUT', data, headers });
  }

  // DELETE request
  async delete(endpoint, headers = {}) {
    return this.makeRequest(endpoint, { method: 'DELETE', headers });
  }

  // Upload file
  async uploadFile(endpoint, file, additionalData = {}) {
    try {
      const token = await authService.getAuthToken();
      const formData = new FormData();
      
      formData.append('file', file);
      
      // Add additional form data
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }
}

// Export service
window.DataService = DataService;
window.dataService = new DataService();