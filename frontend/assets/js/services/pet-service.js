// Pet Management Service
class PetService {
  constructor() {
    this.pets = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;
  }

  // Get all pets for the current user
  async getUserPets() {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const token = await authService.getAuthToken();
      console.log('API URL:', `${API_BASE_URL}/pets/user/${user.uid}`);
      console.log('Auth token available:', !!token);

      const response = await fetch(`${API_BASE_URL}/pets/user/${user.uid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('API response:', result);
      
      if (result.success) {
        this.pets = result.data || [];
        return { success: true, data: result.data || [] };
      } else {
        throw new Error(result.error || 'Failed to fetch pets');
      }
    } catch (error) {
      console.error('Get pets error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load pets';
      if (error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. Please check your permissions.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Pet service not found. Please contact support.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  // Create a new pet
  async createPet(petData) {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate required fields
      if (!this.validatePetData(petData)) {
        throw new Error('Please fill in all required fields');
      }

      const response = await fetch(`${API_BASE_URL}/pets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authService.getAuthToken()}`
        },
        body: JSON.stringify({
          ...petData,
          ownerId: user.uid
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Add to local pets array
        this.pets.push(result.data);
        return { 
          success: true, 
          data: result.data,
          message: 'Pet registered successfully!'
        };
      } else {
        throw new Error(result.error || 'Failed to create pet');
      }
    } catch (error) {
      console.error('Create pet error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to register pet'
      };
    }
  }

  // Update pet information
  async updatePet(petId, petData) {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/pets/${petId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authService.getAuthToken()}`
        },
        body: JSON.stringify(petData)
      });

      const result = await response.json();
      
      if (result.success) {
        // Update local pets array
        const index = this.pets.findIndex(pet => pet.id === petId);
        if (index !== -1) {
          this.pets[index] = result.data;
        }
        return { 
          success: true, 
          data: result.data,
          message: 'Pet updated successfully!'
        };
      } else {
        throw new Error(result.error || 'Failed to update pet');
      }
    } catch (error) {
      console.error('Update pet error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update pet'
      };
    }
  }

  // Delete a pet
  async deletePet(petId) {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/pets/${petId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authService.getAuthToken()}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        // Remove from local pets array
        this.pets = this.pets.filter(pet => pet.id !== petId);
        return { 
          success: true,
          message: 'Pet removed successfully!'
        };
      } else {
        throw new Error(result.error || 'Failed to delete pet');
      }
    } catch (error) {
      console.error('Delete pet error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to remove pet'
      };
    }
  }

  // Get a specific pet by ID
  async getPet(petId) {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/pets/${petId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authService.getAuthToken()}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        return { success: true, data: result.data };
      } else {
        throw new Error(result.error || 'Failed to fetch pet');
      }
    } catch (error) {
      console.error('Get pet error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to load pet information'
      };
    }
  }

  // Get pet health records
  async getPetHealthRecords(petId) {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/pets/${petId}/health-records`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authService.getAuthToken()}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        return { success: true, data: result.data };
      } else {
        throw new Error(result.error || 'Failed to fetch health records');
      }
    } catch (error) {
      console.error('Get health records error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to load health records'
      };
    }
  }

  // Add health record
  async addHealthRecord(petId, recordData) {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/pets/${petId}/health-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await authService.getAuthToken()}`
        },
        body: JSON.stringify(recordData)
      });

      const result = await response.json();
      
      if (result.success) {
        return { 
          success: true, 
          data: result.data,
          message: 'Health record added successfully!'
        };
      } else {
        throw new Error(result.error || 'Failed to add health record');
      }
    } catch (error) {
      console.error('Add health record error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to add health record'
      };
    }
  }

  // Validation helpers
  validatePetData(petData) {
    const requiredFields = ['name', 'species', 'breed'];
    
    for (const field of requiredFields) {
      if (!petData[field] || petData[field].toString().trim() === '') {
        return false;
      }
    }

    // Validate age if provided
    if (petData.age && (petData.age < 0 || petData.age > 30)) {
      return false;
    }

    // Validate weight if provided
    if (petData.weight && (petData.weight <= 0 || petData.weight > 200)) {
      return false;
    }

    return true;
  }

  // Get common pet breeds by species
  getBreedsBySpecies(species) {
    const breeds = {
      'dog': [
        'Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'Bulldog',
        'Poodle', 'Beagle', 'Rottweiler', 'Yorkshire Terrier', 'Dachshund',
        'Siberian Husky', 'Boxer', 'Great Dane', 'Chihuahua', 'Shih Tzu',
        'Boston Terrier', 'Pomeranian', 'Border Collie', 'Australian Shepherd',
        'Cocker Spaniel', 'Maltese', 'Mixed Breed', 'Other'
      ],
      'cat': [
        'Persian', 'Maine Coon', 'British Shorthair', 'Ragdoll', 'Bengal',
        'Abyssinian', 'Birman', 'Oriental Shorthair', 'Manx', 'Devon Rex',
        'American Shorthair', 'Scottish Fold', 'Sphynx', 'Russian Blue',
        'Turkish Van', 'Norwegian Forest Cat', 'Siamese', 'Exotic Shorthair',
        'Domestic Shorthair', 'Domestic Longhair', 'Mixed Breed', 'Other'
      ],
      'bird': [
        'Parakeet', 'Cockatiel', 'Canary', 'Finch', 'Conure', 'Lovebird',
        'Macaw', 'African Grey', 'Cockatoo', 'Caique', 'Other'
      ],
      'rabbit': [
        'Holland Lop', 'Netherland Dwarf', 'Lionhead', 'Mini Rex', 'Flemish Giant',
        'English Angora', 'Dutch', 'Mini Lop', 'Rex', 'Other'
      ],
      'fish': [
        'Goldfish', 'Betta', 'Guppy', 'Angelfish', 'Molly', 'Tetra', 'Barb',
        'Cichlid', 'Platy', 'Swordtail', 'Other'
      ],
      'other': ['Other']
    };

    return breeds[species.toLowerCase()] || ['Other'];
  }

  // Get local pets (cached)
  getLocalPets() {
    return this.pets;
  }

  // Clear local cache
  clearCache() {
    this.pets = [];
  }

  // Pet utility functions
  calculateAge(birthDate) {
    if (!birthDate) return null;
    
    const today = new Date();
    const birth = new Date(birthDate);
    const ageInMonths = (today.getFullYear() - birth.getFullYear()) * 12 + 
                       (today.getMonth() - birth.getMonth());
    
    if (ageInMonths < 12) {
      return `${ageInMonths} months`;
    } else {
      const years = Math.floor(ageInMonths / 12);
      const months = ageInMonths % 12;
      return months > 0 ? `${years} years, ${months} months` : `${years} years`;
    }
  }

  formatWeight(weight, unit = 'lbs') {
    if (!weight) return '';
    return `${weight} ${unit}`;
  }

  getPetIcon(species) {
    const icons = {
      'dog': 'fas fa-dog',
      'cat': 'fas fa-cat',
      'bird': 'fas fa-dove',
      'rabbit': 'fas fa-rabbit-fast',
      'fish': 'fas fa-fish',
      'other': 'fas fa-paw'
    };

    return icons[species.toLowerCase()] || icons.other;
  }
}

// Export service
window.PetService = PetService;
window.petService = new PetService();