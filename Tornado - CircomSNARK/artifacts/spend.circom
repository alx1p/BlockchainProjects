include "./mimc.circom";

/*
 * IfThenElse sets `out` to `true_value` if `condition` is 1 and `out` to
 * `false_value` if `condition` is 0.
 *
 * It enforces that `condition` is 0 or 1.
 *
 */
template IfThenElse() {
    signal input condition;
    signal input true_value;
    signal input false_value;
    signal output out;

    // TODO
    // Hint: You will need a helper signal...

    // It enforces that `condition` is 0 or 1.
    condition * (1-condition) === 0;

    // Need intermediate helper to keep constraints quadratic
    signal false_interm;
    false_interm <== (1-condition) * false_value;

    // Add value if true to value if false, knowing one will be zeroed out
    out <== condition * true_value + false_interm;
}

/*
 * SelectiveSwitch takes two data inputs (`in0`, `in1`) and produces two ouputs.
 * If the "select" (`s`) input is 1, then it inverts the order of the inputs
 * in the ouput. If `s` is 0, then it preserves the order.
 *
 * It enforces that `s` is 0 or 1.
 */
template SelectiveSwitch() {
    signal input in0;
    signal input in1;
    signal input s;
    signal output out0;
    signal output out1;

    // TODO
    // Declare and intialize a sub-circuit; also enforces s is 0 or 1 in sub
    component flipper = IfThenElse();
    flipper.condition <== s;
    flipper.true_value <== in1;
    flipper.false_value <== in0;

    // Flipped on s=1 true (in1), unchanged on false (in0)
    out0 <== flipper.out;

    // The other value goes in the opposite output
    out1 <== in0 + in1 - out0;

}

/*
 * Verifies the presence of H(`nullifier`, `nonce`) in the tree of depth
 * `depth`, summarized by `digest`.
 * This presence is witnessed by a Merle proof provided as
 * the additional inputs `sibling` and `direction`, 
 * which have the following meaning:
 *   sibling[i]: the sibling of the node on the path to this coin
 *               at the i'th level from the bottom.
 *   direction[i]: "0" or "1" indicating whether that sibling is on the left.
 *       The "sibling" hashes correspond directly to the siblings in the
 *       SparseMerkleTree path.
 *       The "direction" keys the boolean directions from the SparseMerkleTree
 *       path, casted to string-represented integers ("0" or "1").
 */
template Spend(depth) {
    signal input digest;
    signal input nullifier;
    signal private input nonce;
    signal private input sibling[depth];
    signal private input direction[depth];

    // TODO

    // We're going to need `depth`+1 intermediate path hashes for the Merkle path (incl final hash) 
    signal intermediate[depth+1];

    // Coin hash is first "intermediate" input
    component coinHash = Mimc2();
    coinHash.in0 <== nullifier;
    coinHash.in1 <== nonce;
    intermediate[0] <== coinHash.out;

    // We're going to need `depth` hash and switch subcircuits for the Merkle path
    component hashes[depth];
    component switches[depth];

    // At each depth, hash together the prior hash with the current sibling, taking into account flipping if needed
    for (var i = 0; i < depth; ++i) {

        // Set up the left and right nodes based on sibling direction - needs flipped if sibling is on left eg if = 1
        switches[i] = SelectiveSwitch();
        switches[i].in0 <== intermediate[i];
        switches[i].in1 <== sibling[i];
        switches[i].s <== direction[i];

        hashes[i] = Mimc2();

        // Left node
        hashes[i].in0 <== switches[i].out0;

        // Right node
        hashes[i].in1 <== switches[i].out1;

        // Hash left and right nodes together to generate next hash upwards on the path
        intermediate[i+1] <== hashes[i].out;
    }

    // Check top hash - should be constrained to be equal to the Merkle root input
    intermediate[depth] === digest;
}
