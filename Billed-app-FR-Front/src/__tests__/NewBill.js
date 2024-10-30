/**
 * @jest-environment jsdom
 */

import { screen, fireEvent, waitFor } from '@testing-library/dom';
import NewBillUI from '../views/NewBillUI';
import NewBill from '../containers/NewBill.js';
import BillsUI from '../views/BillsUI.js';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { ROUTES, ROUTES_PATH } from '../constants/routes';
import { localStorageMock } from '../__mocks__/localStorage';
import mockStore from '../__mocks__/store';
import router from '../app/Router';

// Mock the store module
jest.mock('../app/store', () => mockStore);

// Global variables for common test elements
let newBillInstance;
let root;
let onNavigate;
let formNewBill;

/**
 * Test suite for NewBill page functionality
 * Testing employee role interactions with the NewBill interface
 */
describe('Given I am connected as an employee', () => {
	// Setup before all tests
	beforeAll(() => {
		// Configure localStorage mock
		Object.defineProperty(window, 'localStorage', {
			value: localStorageMock,
		});
	});

	// Reset state and setup common elements before each test
	beforeEach(() => {
		// Clear and initialize localStorage
		localStorage.clear();
		localStorage.setItem(
			'user',
			JSON.stringify({ type: 'Employee' }),
		);

		// Setup navigation handler
		onNavigate = (pathname) => {
			document.body.innerHTML = ROUTES({ pathname });
		};

		// Initialize page content
		document.body.innerHTML = NewBillUI();

		// Initialize NewBill instance with required dependencies
		newBillInstance = new NewBill({
			document,
			onNavigate,
			store: mockStore,
			localStorage: window.localStorage,
		});

		// Get form element
		formNewBill = screen.getByTestId('form-new-bill');
	});

	describe('When I am on NewBill Page', () => {
		/**
		 * Test for initial page render
		 */
		test('Then the NewBill page should be rendered', () => {
			expect(
				screen.getByText('Envoyer une note de frais'),
			).toBeInTheDocument();
		});

		/**
		 * Test suite for form submission functionality
		 */
		describe('When I submit a new Bill', () => {
			/**
			 * Test successful form submission with valid data
			 */
			test('Then it should save the bill with all fields filled correctly', async () => {
				// Verify all form fields are present
				await waitFor(() => {
					const formFields = [
						'expense-type',
						'expense-name',
						'amount',
						'datepicker',
						'vat',
						'pct',
						'commentary',
						'file',
					];
					formFields.forEach((field) => {
						expect(
							screen.getByTestId(field),
						).toBeInTheDocument();
					});
				});

				// Fill form fields with valid data
				await userEvent.selectOptions(
					screen.getByTestId('expense-type'),
					'Transports',
				);
				await userEvent.type(
					screen.getByTestId('expense-name'),
					'Déplacement professionnel',
				);
				await userEvent.type(
					screen.getByTestId('amount'),
					'300',
				);
				await userEvent.type(
					screen.getByTestId('datepicker'),
					'2024-10-27',
				);
				await userEvent.type(screen.getByTestId('vat'), '10');
				await userEvent.type(screen.getByTestId('pct'), '20');
				await userEvent.type(
					screen.getByTestId('commentary'),
					'Voyage pour conférence',
				);

				// Setup and upload valid file
				const validFile = new File(['image'], 'image.png', {
					type: 'image/png',
				});
				const fileInput = screen.getByTestId('file');
				await userEvent.upload(fileInput, validFile);

				// Test form submission
				const handleSubmit = jest.fn((e) =>
					newBillInstance.handleSubmit(e),
				);
				formNewBill.addEventListener('submit', handleSubmit);
				fireEvent.submit(formNewBill);

				expect(handleSubmit).toHaveBeenCalled();
				expect(fileInput.files[0].name).toBe('image.png');
			});

			/**
			 * Test file type validation
			 */
			test('Then it should display an error when the file type is invalid', async () => {
				const invalidFile = new File(
					['doc'],
					'document.pdf',
					{
						type: 'application/pdf',
					},
				);
				const fileInput = screen.getByTestId('file');

				const handleChangeFile = jest.fn((e) =>
					newBillInstance.handleChangeFile(e),
				);
				fileInput.addEventListener(
					'change',
					handleChangeFile,
				);
				userEvent.upload(fileInput, invalidFile);

				expect(handleChangeFile).toHaveBeenCalled();
				expect(
					screen.getByText(/fichier n'est pas autorisé/i),
				).toBeTruthy();
				expect(fileInput.value).toBe('');
			});
		});
	});

	/**
	 * Integration test suite for NewBill page
	 * Testing API interactions and error handling
	 */
	describe('When I navigate to newBill page', () => {
		beforeEach(() => {
			// Setup test environment
			jest.spyOn(mockStore, 'bills');
			localStorage.setItem(
				'user',
				JSON.stringify({ type: 'Employee', email: 'a@a' }),
			);

			// Setup DOM for router
			root = document.createElement('div');
			root.setAttribute('id', 'root');
			document.body.append(root);
			router();
		});

		/**
		 * Test successful API interaction
		 */
		test('Then it should create a new bill via API POST with correct values', async () => {
			window.onNavigate(ROUTES_PATH.NewBill);

			const bills = await mockStore.bills().create();
			expect(bills.key).toBe('1234');
			expect(bills.fileUrl).toBe(
				'https://localhost:3456/images/test.jpg',
			);
		});

		/**
		 * Test 404 error handling
		 */
		test('Then it should handle 404 error when API call fails', async () => {
			window.onNavigate(ROUTES_PATH.NewBill);

			mockStore.bills.mockImplementationOnce(() => ({
				create: () => Promise.reject(new Error('Erreur 404')),
			}));

			await new Promise(process.nextTick);
			document.body.innerHTML = BillsUI({
				error: 'Erreur 404',
			});
			expect(screen.getByText('Erreur 404')).toBeTruthy();
		});

		/**
		 * Test 500 error handling
		 */
		test('Then it should handle 500 error when API call fails', async () => {
			mockStore.bills.mockImplementationOnce(() => ({
				create: () => Promise.reject(new Error('Erreur 500')),
				list: () => Promise.resolve([]),
			}));

			await new Promise(process.nextTick);
			document.body.innerHTML = BillsUI({
				error: 'Erreur 500',
			});
			expect(screen.getByText('Erreur 500')).toBeTruthy();
		});
	});
});
