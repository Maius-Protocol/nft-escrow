import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { NftEscrow } from "../target/types/nft_escrow";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import { keypairIdentity, Metaplex } from "@metaplex-foundation/js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import BN from "bn.js";

// const provider = AnchorProvider.local(
//   'https://solana-mainnet.rpc.extrnode.com',
// )

const provider = AnchorProvider.env();

describe("nft-escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);

  const program = anchor.workspace.NftEscrow as Program<NftEscrow>;

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  // Configure the metaplex client to use the local cluster
  const metaplexConnection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const MINT_A_DECIMALS = 8;
  const MINT_A_AMOUNT = 100 * 10 ** MINT_A_DECIMALS;
  let aliceKeypair = Keypair.fromSecretKey(
    new Uint8Array([
      88, 110, 16, 29, 40, 185, 16, 70, 179, 131, 75, 233, 74, 70, 191, 87, 158,
      143, 61, 116, 221, 40, 132, 230, 184, 201, 4, 141, 89, 225, 229, 211, 134,
      7, 83, 233, 138, 60, 239, 25, 103, 106, 92, 17, 117, 214, 109, 85, 67, 2,
      199, 6, 69, 189, 109, 158, 245, 255, 71, 115, 222, 118, 105, 248,
    ])
  );
  let alice = new Wallet(aliceKeypair);
  let bobKeypair = Keypair.fromSecretKey(
    new Uint8Array([
      55, 92, 68, 201, 124, 36, 8, 216, 162, 198, 96, 156, 247, 115, 215, 31,
      183, 23, 65, 229, 96, 143, 34, 80, 212, 123, 75, 94, 225, 92, 55, 81, 68,
      215, 67, 75, 91, 236, 194, 111, 162, 127, 65, 246, 129, 100, 186, 230, 65,
      208, 70, 49, 173, 64, 60, 186, 0, 56, 46, 144, 37, 119, 106, 78,
    ])
  );
  let bob = new Wallet(bobKeypair);
  let hostKeypair = Keypair.fromSecretKey(
    new Uint8Array([
      217, 23, 20, 39, 36, 82, 210, 10, 38, 80, 8, 63, 98, 203, 41, 216, 189, 7,
      247, 242, 166, 230, 159, 226, 24, 168, 144, 11, 135, 221, 19, 154, 214,
      176, 37, 78, 129, 59, 9, 87, 160, 209, 253, 70, 85, 8, 121, 133, 62, 16,
      216, 250, 28, 29, 30, 229, 29, 246, 209, 186, 73, 61, 75, 211,
    ])
  );
  let host = new Wallet(hostKeypair);
  let aliceNft: PublicKey;
  let takerTokenMint;
  let takerAmount = 10 * 10 ** MINT_A_DECIMALS;
  let bobAssociatedTokenAccount;
  let aliceAssociatedNftTokenAccount;
  let escrow, vaultNft, vaultToken, authorityVault: PublicKey;
  let escrowBump, vaultNftBump, vaultTokenBump, authorityVaultBump: number;

  const metaplex = new Metaplex(metaplexConnection).use(
    keypairIdentity(alice.payer)
  );

  before("Boilerplates", async () => {
    // airdrop
    // await airdrop(provider, alice.publicKey, 1);
    // await delay(1000 * 5);
    // await airdrop(provider, host.publicKey, 1);
    // await delay(1000 * 5);
    // await airdrop(provider, bob.publicKey, 1);

    // Create a common quote mint for all pools
    takerTokenMint = await createMint(
      provider.connection, // conneciton
      host.payer, // fee payer
      host.publicKey, // mint authority
      host.publicKey, // freeze authority
      MINT_A_DECIMALS // decimals
    );
    bobAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      host.payer,
      takerTokenMint,
      bob.publicKey
    );
    await mintTokenAToUser(
      host.payer,
      bobAssociatedTokenAccount,
      takerTokenMint,
      MINT_A_AMOUNT
    );
    let bobTokenAmount = parseInt(
      (
        await provider.connection.getTokenAccountBalance(
          bobAssociatedTokenAccount.address
        )
      ).value.amount
    );
    console.log(`bob token balance: ${bobTokenAmount}`);
  });

  it("Is initialized!", async () => {
    const { nft } = await metaplex.nfts().create(
      {
        name: "Alice NFt",
        sellerFeeBasisPoints: 0,
        uri: "https://arweave.net/Ny-0nK4FFp55qafhMpKQMtOcCrihiSxWsztAZ2fp6-g",
      },
      { commitment: "finalized" }
    );

    aliceNft = nft.address;
    console.log(`alice nft address: ${aliceNft}`);
    aliceAssociatedNftTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      host.payer,
      aliceNft,
      alice.publicKey
    );

    [escrow, escrowBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow_vault"),
        alice.publicKey.toBuffer(),
        aliceNft.toBuffer(),
        bob.publicKey.toBuffer(),
      ],
      program.programId
    );
    [vaultNft, vaultNftBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_nft"), escrow.toBuffer(), aliceNft.toBuffer()],
      program.programId
    );

    [vaultToken, vaultTokenBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault_token"),
        escrow.toBuffer(),
        takerTokenMint.toBuffer(),
      ],
      program.programId
    );

    [authorityVault, authorityVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), escrow.toBuffer()],
      program.programId
    );
    await program.methods
      .initializeEscrow(bob.publicKey, new BN(takerAmount))
      .accounts({
        alice: alice.publicKey,
        escrow: escrow,
        vaultNft: vaultNft,
        vaultToken: vaultToken,
        aliceNft: aliceNft,
        aliceNftAccount: aliceAssociatedNftTokenAccount.address,
        takerToken: takerTokenMint,
        authorityVault: authorityVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([alice.payer])
      .rpc();

    const data = await program.account.escrow.fetch(escrow);
    console.log("[escrow] Create result: ", data);
  });
  it("deposit taker token!", async () => {
    await program.methods
      .depositTakerToken()
      .accounts({
        bob: bob.publicKey,
        escrow: escrow,
        vaultToken: vaultToken,
        bobTakerTokenAccount: bobAssociatedTokenAccount.address,
        takerToken: takerTokenMint,
        authorityVault: authorityVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([bob.payer])
      .rpc();

    const data = await program.account.escrow.fetch(escrow);
    console.log("[escrow] after deposit taker token: ", data);
    let bobTokenAmount = parseInt(
      (
        await provider.connection.getTokenAccountBalance(
          bobAssociatedTokenAccount.address
        )
      ).value.amount
    );
    console.log(`bob balance after deposit taker token: ${bobTokenAmount}`);
    let vaultTokenAmount = parseInt(
      (await provider.connection.getTokenAccountBalance(vaultToken)).value
        .amount
    );
    console.log(`vault token after deposit taker token: ${vaultTokenAmount}`);
  });
  // it("confirm delivery token!", async () => {
  //   let bobAssociatedNftTokenAccount = await getOrCreateAssociatedTokenAccount(
  //     provider.connection,
  //     host.payer,
  //     aliceNft,
  //     bob.publicKey
  //   );
  //   let aliceAssociatedTakerTokenAccount =
  //     await getOrCreateAssociatedTokenAccount(
  //       provider.connection,
  //       host.payer,
  //       takerTokenMint,
  //       alice.publicKey
  //     );
  //   await program.methods
  //     .confirmDelivery()
  //     .accounts({
  //       alice: alice.publicKey,
  //       escrow: escrow,
  //       vaultNft: vaultNft,
  //       vaultToken: vaultToken,
  //       aliceTakerTokenAccount: aliceAssociatedTakerTokenAccount.address,
  //       bobNftAccount: bobAssociatedNftTokenAccount.address,
  //       aliceNft: aliceNft,
  //       takerToken: takerTokenMint,
  //       authorityVault: authorityVault,
  //       systemProgram: SystemProgram.programId,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //     })
  //     .signers([alice.payer])
  //     .rpc();
  //
  //   const data = await program.account.escrow.fetch(escrow);
  //   console.log("[escrow] after confirm delivery: ", data);
  //   let bobTokenAmount = parseInt(
  //     (
  //       await provider.connection.getTokenAccountBalance(
  //         bobAssociatedTokenAccount.address
  //       )
  //     ).value.amount
  //   );
  //   console.log(`bob balance after deposit taker token: ${bobTokenAmount}`);
  //   let vaultTokenAmount = parseInt(
  //     (await provider.connection.getTokenAccountBalance(vaultToken)).value
  //       .amount
  //   );
  //   console.log(`vault token after deposit taker token: ${vaultTokenAmount}`);
  //   let aliceTokenAmount = parseInt(
  //     (
  //       await provider.connection.getTokenAccountBalance(
  //         aliceAssociatedTakerTokenAccount.address
  //       )
  //     ).value.amount
  //   );
  //   console.log(`alice token after deposit taker token: ${aliceTokenAmount}`);
  //   let bobNftAmount = parseInt(
  //     (
  //       await provider.connection.getTokenAccountBalance(
  //         bobAssociatedNftTokenAccount.address
  //       )
  //     ).value.amount
  //   );
  //   console.log(`bob token after deposit taker token: ${bobNftAmount}`);
  // });
  it("cancel escrow!", async () => {
    await program.methods
      .cancelEscrow()
      .accounts({
        signer: alice.publicKey,
        escrow: escrow,
        aliceNft: aliceNft,
        aliceNftAccount: aliceAssociatedNftTokenAccount.address,
        vaultNft: vaultNft,
        bobTakerTokenAccount: bobAssociatedTokenAccount.address,
        vaultToken: vaultToken,
        takerToken: takerTokenMint,
        authorityVault: authorityVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([alice.payer])
      .rpc();
    const data = await program.account.escrow.fetch(escrow);
    console.log("[escrow] after cancel escrow: ", data);
    let vaultTokenAmount = parseInt(
      (await provider.connection.getTokenAccountBalance(vaultToken)).value
        .amount
    );
    console.log(`vault token amount after cancel escrow: ${vaultTokenAmount}`);
    let aliceTokenAmount = parseInt(
      (
        await provider.connection.getTokenAccountBalance(
          aliceAssociatedNftTokenAccount.address
        )
      ).value.amount
    );
    console.log(`alice nft amount after cancel escrow: ${aliceTokenAmount}`);
    let bobNftAmount = parseInt(
      (
        await provider.connection.getTokenAccountBalance(
          bobAssociatedTokenAccount.address
        )
      ).value.amount
    );
    console.log(`bob token amount after cancel: ${bobNftAmount}`);
  });
});

export async function airdrop(
  provider: AnchorProvider,
  pubkey: PublicKey,
  amount: number
) {
  const signature = await provider.connection.requestAirdrop(
    pubkey,
    amount * LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(signature, "confirmed");
  const balance = await provider.connection.getBalance(pubkey);
  console.log(
    `airdropped ${amount} to address ${pubkey.toBase58()} current balance ${balance}`
  );
}

async function mintTokenAToUser(payer, associatedTokenAccount, mint, amount) {
  await mintTo(
    provider.connection,
    payer,
    mint,
    associatedTokenAccount.address,
    payer.publicKey,
    amount
  );
}
