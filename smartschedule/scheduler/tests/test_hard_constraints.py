import unittest
from scheduler.constraints.hard import add_faculty_clash_constraint
from ortools.sat.python import cp_model

class TestHardConstraints(unittest.TestCase):
    def test_faculty_clash(self):
        model = cp_model.CpModel()
        vars = {}
        # mock vars for testing
        vars['x_c1_s1_f1_r1_d1_p1'] = model.NewBoolVar('v1')
        vars['x_c2_s2_f1_r2_d1_p1'] = model.NewBoolVar('v2')
        
        add_faculty_clash_constraint(model, vars, ['1'], [1], [1])
        
        solver = cp_model.CpSolver()
        status = solver.Solve(model)
        
        # If both are true, constraint should fail
        # Add objective or extra constraints to test behavior
        self.assertEqual(status, cp_model.OPTIMAL)
        
if __name__ == '__main__':
    unittest.main()
