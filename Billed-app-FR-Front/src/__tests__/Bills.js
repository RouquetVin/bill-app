/**
 * @jest-environment jsdom
 */

import { screen, waitFor, within } from '@testing-library/dom';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import BillsUI from '../views/BillsUI.js';
import { bills } from '../fixtures/bills.js';
import { ROUTES, ROUTES_PATH } from '../constants/routes.js';
import { localStorageMock } from '../__mocks__/localStorage.js';
import mockedStore from '../__mocks__/store';
import router from '../app/Router.js';
import Bills from '../containers/Bills.js';

// Mock the store module
jest.mock('../app/store', () => mockedStore);

// Global variables for common test elements
let billsInstance;
let root;
let onNavigate;

/**
 * Test suite for Bills page functionality
 * Testing employee role interactions with the Bills interface
 */
describe('Given I am connected as an employee', () => {
	// Setup localStorage mock before all tests
	beforeAll(() => {
		Object.defineProperty(window, 'localStorage', {
			value: localStorageMock,
		});
	});

	// Reset state and setup common elements before each test
	beforeEach(() => {
		// Clear and initialize localStorage with employee user
		localStorage.clear();
		localStorage.setItem(
			'user',
			JSON.stringify({ type: 'Employee' }),
		);

		// Setup navigation handler
		onNavigate = (pathname) => {
			document.body.innerHTML = ROUTES({ pathname });
		};

		// Initialize Bills instance with required dependencies
		billsInstance = new Bills({
			document,
			onNavigate,
			store: mockedStore,
			localStorage: window.localStorage,
		});
	});

	describe('When I am on Bills Page', () => {
		/**
		 * Test for visual indication of active page in layout
		 */
		test('Then the bill icon should be highlighted in the vertical layout', async () => {
			// Setup DOM element for router
			root = document.createElement('div');
			root.setAttribute('id', 'root');
			document.body.append(root);

			router();
			window.onNavigate(ROUTES_PATH.Bills);

			await waitFor(() => screen.getByTestId('icon-window'));
			const windowIcon = screen.getByTestId('icon-window');
			expect(windowIcon).toHaveClass('active-icon');
		});

		/**
		 * Test for correct chronological ordering of bills
		 */
		test('Then bills should be ordered from earliest to latest', () => {
			document.body.innerHTML = BillsUI({ data: bills });

			// Get all date elements from the UI
			const dates = screen
				.getAllByText(
					/^(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])$/i,
				)
				.map((a) => a.innerHTML);

			// Sort dates in reverse chronological order
			const antiChrono = (a, b) =>
				new Date(b.date) - new Date(a.date);
			const datesSorted = [...dates].sort(antiChrono);

			expect(dates).toEqual(datesSorted);
		});

		/**
		 * Test suite for New Bill button functionality
		 */
		describe('When I click on New Bill Button', () => {
			test('Then it should navigate to New Bill form', () => {
				document.body.innerHTML = BillsUI({ data: bills });

				// Find and verify New Bill button
				const buttonNewBill = screen.getByRole('button', {
					name: /nouvelle note de frais/i,
				});
				expect(buttonNewBill).toBeTruthy();

				// Test click handler
				const handleClickNewBill = jest.fn(
					billsInstance.handleClickNewBill,
				);
				buttonNewBill.addEventListener(
					'click',
					handleClickNewBill,
				);

				userEvent.click(buttonNewBill);
				expect(handleClickNewBill).toHaveBeenCalled();
			});
		});

		/**
		 * Test suite for eye icon (bill preview) functionality
		 */
		describe('When I click on one eye icon', () => {
			test('Then a modal should open', async () => {
				document.body.innerHTML = BillsUI({ data: bills });

				// Setup modal interaction elements
				const iconEyes = screen.getAllByTestId('icon-eye');
				const handleClickIconEye = jest.fn(
					billsInstance.handleClickIconEye,
				);
				const modale = document.getElementById('modaleFile');

				// Mock jQuery modal function
				$.fn.modal = jest.fn(() =>
					modale.classList.add('show'),
				);

				// Test each eye icon
				iconEyes.forEach((iconEye) => {
					iconEye.addEventListener('click', () =>
						handleClickIconEye(iconEye),
					);
					userEvent.click(iconEye);

					expect(handleClickIconEye).toHaveBeenCalled();
					expect(modale).toHaveClass('show');
				});
			});
		});
	});

	/**
	 * Test suite for loading state
	 */
	describe('When I go to Bills page and it is loading', () => {
		test('Then it should render Loading page', () => {
			document.body.innerHTML = BillsUI({ loading: true });
			expect(screen.getByText('Loading...')).toBeVisible();
		});
	});

	/**
	 * Test suite for error handling
	 */
	describe('When I am on Bills page but the back-end sends an error message', () => {
		test('Then it should render Error page', () => {
			document.body.innerHTML = BillsUI({
				error: 'error message',
			});
			expect(screen.getByText('Erreur')).toBeVisible();
		});
	});

	/**
	 * Integration test suite for Bills page
	 * Testing API interactions and error handling
	 */
	describe('When I navigate to Bills Page', () => {
		beforeEach(() => {
			// Setup user and DOM element for each test
			localStorage.setItem(
				'user',
				JSON.stringify({ type: 'Employee', email: 'a@a' }),
			);
			root = document.createElement('div');
			root.setAttribute('id', 'root');
			document.body.append(root);
		});

		/**
		 * Test successful API data fetching
		 */
		test('Then it should fetch bills from mock API GET', async () => {
			jest.spyOn(mockedStore, 'bills');

			router();
			window.onNavigate(ROUTES_PATH.Bills);

			await waitFor(() =>
				screen.getByText('Mes notes de frais'),
			);

			// Verify UI elements after data load
			const newBillBtn = await screen.findByRole('button', {
				name: /nouvelle note de frais/i,
			});
			const billsTableRows = screen.getByTestId('tbody');

			expect(newBillBtn).toBeTruthy();
			expect(billsTableRows).toBeTruthy();
			expect(
				within(billsTableRows).getAllByRole('row'),
			).toHaveLength(4);
		});

		/**
		 * Test 404 error handling
		 */
		test('Then it should fail with 404 message error when fetching bills from an API', async () => {
			mockedStore.bills.mockImplementationOnce(() => ({
				list: () => Promise.reject(new Error('Erreur 404')),
			}));

			window.onNavigate(ROUTES_PATH.Bills);
			await new Promise(process.nextTick);

			expect(screen.getByText(/Erreur 404/)).toBeTruthy();
		});

		/**
		 * Test 500 error handling
		 */
		test('Then it should fail with 500 message error when fetching messages from an API', async () => {
			mockedStore.bills.mockImplementationOnce(() => ({
				list: () => Promise.reject(new Error('Erreur 500')),
			}));

			window.onNavigate(ROUTES_PATH.Bills);
			await new Promise(process.nextTick);

			expect(screen.getByText(/Erreur 500/)).toBeTruthy();
		});
	});
});
